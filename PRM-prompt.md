# PRM Backend Developer Prompt: Open Instagram Post Import Endpoint

Please implement a new API endpoint in the PRM backend to support importing Instagram posts directly from the Chrome Extension. 

Since the extension will handle downloading the images locally in the user's browser, you will receive the images as Base64-encoded data URIs directly in the request payload. Posts will be sent sequentially, one at a time.

---

## Endpoint Specification

### `POST /api/v1/posts/import`

- **Authentication**: Requires the extension token via the `X-Extension-Token` header.
- **Headers**:
  - `Content-Type: application/json`
  - `X-Extension-Token: <session_token>`

### Request Payload Format:
```json
{
  "username": "instagram_username",
  "platform": "Instagram",
  "post": {
    "post_id": "3123456789012345678",
    "shortcode": "C8d823xABcd",
    "caption": "Had a great time coding today! #prm",
    "taken_at": 1719182367,
    "media_type": 8, // 1 = Image, 2 = Video (thumbnail only), 8 = Carousel
    "media": [
      {
        "type": "image",
        "filename": "C8d823xABcd_0.jpg",
        "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."
      },
      {
        "type": "image",
        "filename": "C8d823xABcd_1.jpg",
        "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."
      }
    ]
  }
}
```

### Request Payload Fields:
- `username` (string, required): The Instagram username of the post's owner.
- `platform` (string, required): Always `"Instagram"` for this source.
- `post` (object, required): The post details.
  - `post_id` (string, required): The Instagram post ID (`pk` or `id`). Use this for de-duplication.
  - `shortcode` (string, required): The Instagram shortcode.
  - `caption` (string, optional): The caption text.
  - `taken_at` (integer, required): Unix epoch timestamp of when the post was created.
  - `media_type` (integer, required): Instagram's original media type (1 = Image, 2 = Video, 8 = Carousel).
  - `media` (array of objects, required):
    - `type` (string): Always `"image"` (if it was a video, the extension extracts its cover thumbnail and sends it as an image).
    - `filename` (string): Suggested filename for saving.
    - `data` (string): The Base64 Data URL of the image (e.g. `data:image/jpeg;base64,...`).

---

## Required Backend Logic:

1. **Auth Verification**: Validate the token in `X-Extension-Token`. Return `401 Unauthorized` if invalid.
2. **Find or Create Contact**:
   - Query the database for a Social Account matching `username` and `platform`.
   - If it exists, retrieve the associated Contact.
   - If it does not exist, create a new Social Account (and optionally a new placeholder Contact or associate it with an existing one if matching metadata exists).
3. **De-duplicate Post**:
   - Check if a post with `post_id` or `shortcode` is already stored in the system for this contact.
   - If the post already exists, skip creating it (or update its caption) and return a successful `200 OK` response indicating it was already imported.
4. **Decode and Store Images**:
   - Parse each item in the `media` array.
   - Extract the Base64 payload, decode it, and write it to your local file storage or S3 bucket.
   - Save the public URL or relative path of the stored file in the post's media relationship.
5. **Save Post**:
   - Create a post record associated with the contact, storing the caption, timestamp, shortcode, and local links to the downloaded images.
6. **Response**: 
   - Success: `201 Created` with a JSON summary.
     ```json
     {
       "success": true,
       "post_id": "3123456789012345678",
       "status": "imported",
       "saved_media_count": 2
     }
     ```
   - Duplicate: `200 OK`
     ```json
     {
       "success": true,
       "post_id": "3123456789012345678",
       "status": "already_exists"
     }
     ```
   - Error: `400 Bad Request` or `500 Internal Server Error` with structured error messages.
