// Everything you'll want to personalise lives in this file.
// Change it, save, and the page reloads with your edits.

export const config = {
  title: 'Our Museum',

  // The two of you. `color` tints the name tag.
  // `model` is optional: drop a rigged .glb into public/models/ and point to it here.
  // The app plays any animation whose name contains "idle", "walk" or "sit".
  players: [
    {
      name: 'Nimish',
      color: '#4a90d9',
      model: null, // e.g. '/models/nimish.glb'
      look: { skin: '#d9a684', hair: '#1c1512', top: 'plaid', topColor: '#74777d', pants: '#93acc8', hairStyle: 'short' },
    },
    {
      name: 'Shubhangie',
      color: '#d4537e',
      model: null, // e.g. '/models/shubhangie.glb'
      look: { skin: '#e4b494', hair: '#1c1512', top: 'puff', topColor: '#e39aab', pants: '#93acc8', hairStyle: 'long' },
    },
  ],

  // Words on the stand at the entrance.
  dedication: {
    heading: 'For Shubhangie',
    body: 'Every frame in here is a day I am glad I spent with you. Walk slowly.',
    signature: 'Nimish',
  },

  // Photos: 'auto' hangs every image in public/photos/, sorted by file name.
  // Just drop files in that folder; the page reloads on its own.
  // (You can still give a list instead, like [{ src: '/photos/a.jpg', caption: 'Hi', date: '' }].)
  photos: 'auto',

  // Which photo is the big centrepiece. Leave null to use the first one.
  centrepiece: null, // e.g. 'IMG_4511.jpg'

  // Optional plaque text under a photo, by file name.
  captions: {
    // 'IMG_4403.jpg': { caption: 'Our first photo together', date: 'June 2025' },
  },

  // Film for the screening room. 'auto' plays the first .mp4 / .webm in public/video/.
  // iPhone .MOV files usually won't play in Chrome; convert them to .mp4 first (see README).
  video: 'auto',

  // Optional background music (mp3) in public/audio/. Leave null for silence.
  music: null, // e.g. '/audio/our-song.mp3'
};
