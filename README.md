# Arcade × Videoselz

Describe a design and get a real product with its videos.

1. **Arcade** turns your description into a pattern and the pattern into a
   made-to-order product: fabric, size, mockup photos and a unit price.
2. **Videoselz** puts the product on a Shopify store. It then makes 3 short
   story videos and a banner loop, and adds them to the product page.

This repo is the website. It is a React app with no backend of its own. Every
request goes to one Videoselz endpoint, and Videoselz holds the Arcade API key.

## How it uses the Arcade API

| Step on the page | Arcade API call |
| --- | --- |
| Load the product types | `categories/list` |
| Describe your design → Generate pattern | `patterns/create` (prompt + optional colours) |
| Tweak it | `patterns/refine/edit` |
| Wait for a pattern or product | `jobs/get` (polled every 3 s) |
| Choose the product and its options | `categories/get` (only options that can be made, plus `canManufacture`) |
| Create the product | `products/create` |
| Send to Videoselz | `products/get` (title, photos, description, care instructions, maker, unit price) |

Open **Behind the scenes** at the bottom of the page to see each call as it
happens.

## Flow

```
Browser ── POST /arcade-public/studio ──► Videoselz (Gadget) ──► Arcade API
                                              │
                                              ├─ creates the Shopify product
                                              └─ makes 3 story videos + a banner loop
Browser ◄── polls { op: "videos" } ───────────┘
```

## Run it locally

```bash
npm install
cp .env.example .env
npm run dev
```

`VITE_VIDEOSELZ_URL` in `.env` is the Videoselz endpoint. It is a public URL,
not a secret. The Videoselz side is switched off unless the Videoselz team
turns it on. Steps that cost money (patterns, products, videos) also need an
access code. **Email yash@videoselz.com to have it turned on and to get a
code.**

## Deploy

The site is static, so it runs on any static host.

- **Vercel**: import this repo. The framework preset is Vite, the build command
  is `npm run build` and the output directory is `dist`. Add
  `VITE_VIDEOSELZ_URL` as an environment variable.
- **Render**: create a Static Site with the same build command and publish
  directory `dist`.

## FAQ

**"The Videoselz API is turned off right now."**
The Videoselz endpoint runs on a development server that we switch on for
demos. Email yash@videoselz.com and we'll turn it on.

**"Can't reach Videoselz."**
The development server may be asleep. Wait a few seconds and reload. If it
keeps happening, email yash@videoselz.com.

**"That access code isn't right."**
Generating patterns, products and videos costs money, so those steps need the
code from the Videoselz team.

**"Videoselz has made today's demo products."**
There is a daily limit on products sent to Videoselz. Try again tomorrow, or
email us.

**The pattern or product takes a while.**
Arcade takes about 1–2 minutes for each. The progress bar is an estimate.

**The videos take a while.**
Each video is planned, generated, narrated and rendered. Expect several minutes.
The tiles update on their own.

**Where are the keys?**
Not in this repo. The Arcade API key lives only on the Videoselz server. The
site has no secrets; `.env` only holds the public endpoint URL.
