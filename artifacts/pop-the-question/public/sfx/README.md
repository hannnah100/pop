# Sound Effects

Sound effects in Pop: The Question are **synthesized programmatically** via the
Web Audio API in `src/lib/sfx.ts`. No binary audio files are shipped, which
keeps the bundle small, avoids licensing questions, and lets us ship sound
without depending on remote assets.

If you want to swap in real CC0/royalty-free clips later, drop them in this
folder (e.g. `correct.mp3`, `wrong.mp3`, `strike.mp3`, `tick.mp3`,
`victory.mp3`) and replace the `players` map in `src/lib/sfx.ts` with
`HTMLAudioElement` instances.

## Sounds in use

| Name      | Purpose                              |
| --------- | ------------------------------------ |
| `correct` | Right answer / correct guess         |
| `wrong`   | Wrong answer / invalid input         |
| `strike`  | Strike counter increment             |
| `tick`    | Final-seconds countdown ticks        |
| `victory` | Game / puzzle completion fanfare     |
| `tap`     | Generic button tap                   |
| `whoosh`  | Page transitions / card swaps        |

A persistent **mute toggle** lives in the corner of every screen. The user's
preference is stored in `localStorage` under `ptq-sfx-muted` and **defaults to
muted on first load** so we never autoplay sound without intent.
