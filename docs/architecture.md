# FrameLink — Architecture

## 1. High-level components

```mermaid
flowchart TB
    subgraph Client["Browser"]
        TeamUI["Team / Admin dashboard<br/>(authenticated)"]
        GalleryUI["Client gallery<br/>(PIN, no account)"]
    end

    subgraph Vercel["Next.js 14 (Vercel)"]
        MW["middleware.ts<br/>edge redirect gate"]
        RSC["Server Components<br/>read models"]
        API["Route handlers /api/*<br/>mutations + auth"]
        LIB["lib/: auth · authz · gallery<br/>rate-limit · images (sharp)"]
    end

    subgraph Supabase["Supabase"]
        PG[("Postgres<br/>Prisma")]
        OBJ[["Storage<br/>private bucket + CDN"]]
    end

    TeamUI --> MW --> RSC & API
    GalleryUI --> API
    RSC --> LIB
    API --> LIB
    LIB -->|"Prisma (pooled)"| PG
    LIB -->|"service-role key<br/>signed URLs"| OBJ
    GalleryUI -.->|"signed URL (time-limited)"| OBJ
```

## 2. Entity relationships

```mermaid
erDiagram
    User ||--o{ Event : "creates (ADMIN)"
    User ||--o{ EventMember : "is"
    Event ||--o{ EventMember : "has"
    Event ||--o{ Photo : "collects"
    User ||--o{ Photo : "uploads"
    Event ||--o{ Gallery : "publishes"
    Gallery ||--o{ GalleryPhoto : "snapshots"
    Photo ||--o{ GalleryPhoto : "appears in"
    Gallery ||--o{ GalleryAccessLog : "records PIN attempts"

    User {
        string id PK
        string email UK
        enum   role "ADMIN | TEAM_MEMBER"
        string passwordHash
        bool   mustChangePassword
    }
    Event {
        string id PK
        string name
        string createdById FK
    }
    EventMember {
        string eventId FK
        string userId FK
    }
    Photo {
        string id PK
        string eventId FK
        string uploadedById FK
        string storageKey UK
        string thumbnailKey
        int    fileSize
        enum   status "PENDING | READY | FAILED"
        bool   selected
    }
    Gallery {
        string id PK
        string eventId FK
        string slug UK
        string pinHash
        bool   published
        datetime expiresAt
        bool   allowDownload
    }
    GalleryPhoto {
        string galleryId FK
        string photoId FK
        int    order
    }
    GalleryAccessLog {
        string galleryId FK
        bool   success
        string ipHash
    }
```

## 3. Publish + customer-access sequence

```mermaid
sequenceDiagram
    participant A as Admin
    participant M as Team member
    participant S as Next.js API
    participant DB as Postgres
    participant OS as Supabase Storage
    participant C as Customer

    A->>S: POST /api/events (create)
    A->>S: POST /api/events/:id/members (add M)
    M->>S: POST /api/events/:id/photos (multipart, N files)
    loop each file
        S->>DB: Photo(PENDING)
        S->>OS: put original
        S->>OS: put sharp thumbnail
        S->>DB: Photo(READY, dimensions)
    end
    A->>S: POST /api/events/:id/photos/select (bulk)
    A->>S: POST /api/events/:id/galleries (photoIds, pin?)
    S->>DB: Gallery(pinHash, slug) + GalleryPhoto[]
    S-->>A: { url, pin }  (pin shown once)

    C->>S: GET /gallery/:slug
    S->>DB: gallery (published? expired?)
    S-->>C: metadata + PIN gate
    C->>S: POST /api/gallery/:slug/verify { pin }
    S->>DB: rate-limit check (GalleryAccessLog)
    S->>S: bcrypt compare
    S->>DB: log attempt
    S-->>C: Set-Cookie framelink_gallery_<slug> (httpOnly, slug-bound JWT, short TTL)
    C->>S: GET /api/gallery/:slug/photos?cursor
    S->>OS: createSignedUrls(keys)
    S-->>C: { photos: [signed thumbnail + preview URLs], nextCursor }
```

## 4. Authorization decision points

| Guard (`src/lib/authz.ts`) | Used by | Rule |
|---|---|---|
| `assertEventAccess(user, eventId)` | every event / photo / gallery route | ADMIN → any event; TEAM_MEMBER → only via `EventMember`; otherwise **404** (existence hidden) |
| `assertAdmin(user)` | member add/remove, photo select, all gallery writes | non-admin → **403** |
| `assertPhotoManage(user, photoId)` | `DELETE /api/photos/:id` | uploader or ADMIN only |
| `requireGalleryAccess(slug)` (`gallery-session.ts`) | `/api/gallery/:slug/photos`, `/download/*` | valid slug-scoped JWT cookie required |
| `assertGalleryViewable(gallery)` (`gallery.ts`) | all public gallery routes | must be `published` and not past `expiresAt` |

## 5. Why the design scales

- **Cursor pagination** everywhere photos are listed — no `OFFSET` scans at 1,000+ photos.
- **Composite indexes** `[eventId, selected]` and `[eventId, status]` make the admin's "selected only" / "ready only" filters index-only.
- **Selection is a boolean on `Photo`**; publishing **snapshots** into `GalleryPhoto`, so re-curating a future gallery never disturbs a live one.
- **Storage is addressed by key**, never listed — all reads are point lookups turned into signed URLs.
- Stateless JWT sessions → the app layer is horizontally scalable with no shared session store.
- The one piece of mutable shared state (PIN rate limiting) is a bounded, indexed table today and can move to Redis without touching callers.
