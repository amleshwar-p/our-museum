# Our Museum

A little 3D museum of your photos that Nimish and Shubhangie can walk through together, live, from two phones or laptops.

## Run it on your computer

```bash
npm install
npm run dev
```

Open http://localhost:5173, pick your name, type a secret word, and enter.

Without Supabase keys it runs in **test mode**: open a second tab in the same browser with the same secret word to see the second visitor. To play together from two devices, set up Supabase (below).

## Make it yours

Everything personal lives in `src/config.js`:

- **Photos:** drop pictures into `public/photos/` and they're hung automatically, sorted by file name; the page reloads by itself. Set `centrepiece` to the file name you want as the big one, and add plaque text under `captions`. The hall grows longer to fit up to 45 photos. JPG works best; iPhone HEIC photos need converting to JPG first.
- **Dedication:** the words on the stand at the entrance.
- **Video:** drop an `.mp4` into `public/video/` and it plays when you walk into the screening room. iPhone `.MOV` videos are usually HEVC, which Chrome can't play, and they're huge, so convert them first:

  ```bash
  ffmpeg -i IMG_1234.MOV -vf "scale=-2:720,fps=30,format=yuv420p" -c:v libx264 -crf 23 -c:a aac -movflags +faststart public/video/our-film.mp4
  ```

  Then keep the original `.MOV` outside `public/`, or it gets uploaded with the site.
- **Music:** put an mp3 in `public/audio/` and set `music`.
- **Characters:** when your Meshy or Tripo models are ready, put `nimish.glb` and `shubhangie.glb` in `public/models/` and set `model: '/models/nimish.glb'` (and the same for Shubhangie). Any animation named with "idle", "walk" or "sit" plays automatically. Until then, the cute placeholder characters are used, and their colours are under `look`.

## Play together online (free, about 5 minutes)

1. Create a free account at [supabase.com](https://supabase.com) and make a new project (any name, any region near you).
2. In the project, open **Project Settings → API** and copy the **Project URL** and the **anon / publishable key**.
3. Copy `.env.example` to `.env.local` and paste both values in.
4. Restart `npm run dev`.

You don't need to create any tables. The museum only uses Realtime (presence and broadcast), which works out of the box.

## Put it on the internet (free)

1. Push this folder to a **private** GitHub repository.
2. Go to [vercel.com](https://vercel.com), choose **Add New → Project**, and import the repository. Vercel detects Vite automatically.
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values as in `.env.local`.
4. Click **Deploy**. You get a link like `our-museum.vercel.app`; send it and the secret word to Shubhangie.

Every time you push a change (new photos, new words), Vercel redeploys on its own.

## Controls

| | Computer | Phone |
|---|---|---|
| Walk | W A S D or arrow keys | Joystick (bottom right) |
| Look around | Drag the screen, scroll to zoom | Drag the screen, pinch to zoom |
| View a photo, sit, read | Walk close and press E (or click a photo) | Walk close and tap the pink button |
| Chat | Enter | Tap the chat box |
| Send a heart | H | Heart button |

## Good to know

- The secret word keeps the two of you in your own room, but it isn't a password lock: anyone who has the site link can still open the photo files directly. Use a link you only share with each other.
- A free Supabase project pauses after about a week with no visits. Open the Supabase dashboard and click **Restore** to wake it up.
