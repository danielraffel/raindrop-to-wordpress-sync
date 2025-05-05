const functions = require('@google-cloud/functions-framework');
const axios = require('axios');

// Configure Axios instance for WordPress REST API
const wpAxios = axios.create({
    baseURL: `${process.env.WORDPRESS_API_URL}/wp-json/wp/v2`,
    auth: {
        username: process.env.WORDPRESS_USERNAME,
        password: process.env.WORDPRESS_APP_PASSWORD
    }
});

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/Los_Angeles'
    });
}

async function getLatestRaindropBookmark() {
    const response = await axios.get('https://api.raindrop.io/rest/v1/raindrops/0', {
        headers: {
            'Authorization': `Bearer ${process.env.RAINDROP_API_KEY}`
        },
        params: {
            tag: '1',
            sort: '-created',
            perpage: 10
        }
    });

    if (response.data.items && response.data.items.length > 0) {
        const match = response.data.items.find(item => Array.isArray(item.tags) && item.tags.includes('1'));
        return match || null;
    }
    return null;
}

function shouldProcessBookmark(bookmark) {
    const hasNote = !!bookmark.note?.trim();
    const hasHighlights = Array.isArray(bookmark.highlights) && bookmark.highlights.length > 0;
    const hasHighlightNotes = bookmark.highlights?.some(h => h.note?.trim());
    return hasNote || hasHighlights || hasHighlightNotes;
}

function formatWordPressContent(bookmark) {
    const { _id, title, link, created, note = '', highlights = [] } = bookmark;
    const formattedDate = formatDate(created);
    const htmlParts = [];

    htmlParts.push(`<div class="link-item" data-raindrop-id="${_id}" data-created="${formattedDate}">`);

    if (note.trim()) {
        htmlParts.push(`<p>${escapeHtml(note)}</p>`);
    }

    highlights.forEach(h => {
        if (h.text?.trim()) {
            htmlParts.push(`<blockquote>${escapeHtml(h.text)}</blockquote>`);
            if (h.note?.trim()) {
                htmlParts.push(`<p>${escapeHtml(h.note)}</p>`);
            }
        }
    });

    htmlParts.push(`<p><a href="${escapeHtml(link)}" target="_blank">Original link</a></p>`);
    htmlParts.push(`</div>`);

    return {
        title: title || 'Untitled',
        content: htmlParts.join('\n'),
        status: 'publish',
        excerpt: bookmark.excerpt || '',
        meta: { raindrop_id: _id },
        tags: ['raindrop']
    };
}

function escapeHtml(str) {
    return str?.replace(/[&<>"']/g, function (m) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[m];
    }) || '';
}

async function findExistingPost(raindropId) {
    const response = await wpAxios.get('/posts', {
        params: {
            meta_key: 'raindrop_id',
            meta_value: raindropId
        }
    });

    return response.data.length > 0 ? response.data[0] : null;
}

functions.http('raindropToWordpressSync', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
        console.warn('Unauthorized request - invalid secret');
        return res.status(401).send('Unauthorized');
    }

    try {
        console.log('Starting sync process...');
        const bookmark = await getLatestRaindropBookmark();

        if (!bookmark) {
            console.log('No bookmarks with tag "1" found');
            return res.status(200).send('No bookmarks to process');
        }

        if (!shouldProcessBookmark(bookmark)) {
            console.log('Bookmark has no notes or highlights, skipping');
            return res.status(200).send('Bookmark skipped - no content to process');
        }

        const postContent = formatWordPressContent(bookmark);
        const existingPost = await findExistingPost(bookmark._id);

        if (existingPost) {
            console.log(`Updating existing post: ${existingPost.id}`);
            await wpAxios.post(`/posts/${existingPost.id}`, postContent);
            return res.status(200).send(`Updated post ${existingPost.id}`);
        } else {
            console.log('Creating new post');
            const newPost = await wpAxios.post('/posts', postContent);
            return res.status(200).send(`Created new post ${newPost.id}`);
        }

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        return res.status(500).send(error.message);
    }
});
