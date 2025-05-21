# ⚠️ Disclaimer: This is untested.

I use a custom tag in [Raindrop to automatically publish bookmarks to my Ghost blog](https://github.com/danielraffel/raindrop-to-ghost-sync). A friend asked if this could be adapted for WordPress—so I decided to take a first pass at it. If you're brave give it a try and lmk. ✊

# raindrop-to-wordpress-sync

**raindrop-to-wordpress-sync** is a serverless Google Cloud Function that syncs your [Raindrop.io](https://raindrop.io) bookmarks to your [WordPress](https://wordpress.org) blog. It lets you use a custom tag to automatically publish selected bookmarks—with notes and highlights—straight to your blog, making it perfect for public linkrolls or curated reading lists.

> ✨ For a high-level overview and design rationale, check out [this post](https://danielraffel.me/2024/01/30/intriguing-stuff/).

---

## ☑️ Why Use It?

You can publish a link to your blog the moment you find something worth sharing using the Raindrop.io browser extension. It’s a fast, natural way to save and post what you’re reading.

You can use this feature to:
- Share quotes with commentary  
- Build a public reading list  
- Leave breadcrumbs from your research  
- Start lightweight posts that are part blog, part bookmark  
- Automatically cross-post content from Raindrop to your WordPress blog

---

## 📚 Example Workflow

1. Save a page using the Raindrop extension in your browser (desktop or mobile).
2. Highlight a passage and add a note using the Raindrop extension.
3. Automatically publish to your WordPress blog.

---

## ✨ Features

- **Automatic Publishing**: Syncs the most recent Raindrop bookmark with a custom tag of your choice to your WordPress blog.
- **Update Detection**: If the bookmark was already synced, the corresponding WordPress post will be updated (not duplicated).
- **Clean Formatting**: Notes and highlights are wrapped in semantic HTML.
- **Metadata Embedded**: Posts include embedded metadata (like Raindrop ID) as custom fields.

---

## ⚙️ Technical Stack

- **Google Cloud Functions** (Gen 2, Node.js 20)
- **Google Cloud Scheduler** (optional): Automates sync on a recurring schedule
- **Raindrop REST API**: Fetches bookmarks
- **WordPress REST API**: Publishes or updates blog posts
- **Node.js Libraries**: `axios`, `@google-cloud/functions-framework`

---

## 🚀 Setup Instructions

### 1. Prerequisites

- A [Google Cloud Platform (GCP)](https://cloud.google.com/) account
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
- [Node.js and npm](https://nodejs.org/)
- A [Raindrop.io developer integration](https://developer.raindrop.io/v1/authentication)
- A self-hosted or WordPress.com blog that supports Application Passwords

### 2. Clone the Repository

```bash
git clone https://github.com/danielraffel/raindrop-to-wordpress-sync.git
cd raindrop-to-wordpress-sync
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Set Environment Variables

| Variable                  | Description                                                      |
|---------------------------|------------------------------------------------------------------|
| `RAINDROP_API_KEY`        | Your Raindrop test token                                         |
| `WORDPRESS_API_URL`       | Your WordPress blog URL (e.g. `https://yourdomain.com`)           |
| `WORDPRESS_USERNAME`      | Your WordPress username                                          |
| `WORDPRESS_APP_PASSWORD`  | Your WordPress Application Password                              |
| `SYNC_SECRET`             | A token to authenticate sync trigger requests                    |

### 5. Deploy to Google Cloud Functions

```bash
gcloud functions deploy raindropToWordpressSync \
  --gen2 \
  --runtime nodejs20 \
  --trigger-http \
  --region YOUR_REGION \
  --entry-point raindropToWordpressSync \
  --set-env-vars \
    RAINDROP_API_KEY=YOUR_RAINDROP_KEY,\
    WORDPRESS_API_URL=https://yourdomain.com,\
    WORDPRESS_USERNAME=yourname,\
    WORDPRESS_APP_PASSWORD=yourpass,\
    SYNC_SECRET=YOUR_SECRET
```
Replace `[YOUR_REGION](https://app.raindrop.io/settings/integrations)`, [YOUR_RAINDROP_KEY](http://raindrop.io/integrations), `https://yourdomain.com`, `yourname`, `yourpass`, `YOUR_SECRET`.


### 🔍 Testing the Function

```bash
curl -X POST https://REGION-PROJECT.cloudfunctions.net/raindropToWordpressSync   -H "Authorization: Bearer YOUR_SECRET"
```

Replace REGION-PROJECT with your region from the output of the prior command, `YOUR_SECRET` with your [Test token](https://developer.raindrop.io/v1/authentication/token)

### ♻️ Updating the Function

```bash
gcloud functions deploy raindropToWordpressSync \
  --gen2 \
  --runtime nodejs20 \
  --trigger-http \
  --region YOUR_REGION \
  --entry-point raindropToWordpressSync
```

Replace `[YOUR_REGION](https://app.raindrop.io/settings/integrations)`.

### ⏰ Automate with Google Cloud Scheduler

Create a recurring job:

```bash
gcloud scheduler jobs create http raindrop-wordpress-sync \
  --location=us-central1 \
  --schedule="*/15 * * * *" \
  --uri=https://us-central1-YOUR_PROJECT.cloudfunctions.net/raindropToWordpressSync \
  --http-method=POST \
  --headers="Authorization=Bearer ${SYNC_SECRET}" \
  --attempt-deadline=540s
```

---

## 🔧 WordPress Setup: Register the Meta Field

To allow querying your posts by `raindrop_id`, add this to your WordPress theme's `functions.php`:

```php
function register_raindrop_meta_field() {
    register_post_meta('post', 'raindrop_id', [
        'type'         => 'string',
        'description'  => 'Raindrop bookmark ID',
        'single'       => true,
        'show_in_rest' => true,
    ]);
}
add_action('init', 'register_raindrop_meta_field');
```

You only need to do this once. Make sure your theme or plugin isn't disabling custom REST meta fields.

---

## 📌 To Do

- Add deletion support if Raindrop tag is removed
- Add support for `.env` file loading in local dev
- Test is 😂

---

## 📄 License

MIT License.
