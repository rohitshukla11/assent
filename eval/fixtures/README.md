# Eval fixtures

Every image here is synthetic. No real person appears in any of them.

| File | What it is | How it was made |
|---|---|---|
| `maya.jpg` | The licensed creator, one person | The synthetic demo creator's public profile photo (generated with Gemini for likeness-ai, never a real person), as stored |
| `two-people.jpg` | Two people in one image: the creator and the stranger | Muse Image multi-image edit of `maya.jpg` (first image) and `wrong-face.jpg` (second), 2026-10-30 (`scripts/synthetic-faces.ts`); prompt below |
| `face-cut.jpg` | The face cut by the image edge | `maya.jpg` shifted up so the top of the face leaves the frame (`scripts/eval-fixtures.ts`) |
| `no-person.jpg` | A scene with nobody in it | Drawn shapes, no photo (`scripts/eval-fixtures.ts`) |
| `wrong-face.jpg` | Someone who isn't the licensed creator | A fully synthetic face: Muse Image from text only, no reference images, 2026-10-30 (`scripts/synthetic-faces.ts`); prompt below |

The consent-gate cases in `eval/briefs.json` read these files directly; the gate never sees them as
renders by a model. Rebuild `maya.jpg`, `face-cut.jpg` and `no-person.jpg` with `pnpm eval:fixtures` (free).

## The Muse Image fixtures

Made with `pnpm eval:synthetic-faces --yes` (two images, $0.02): model `muse-image-1.0`, size `1024x1024`
(1:1), reasoning strength `high`, temperature 0.6, top_p 0.9, image search, web search and shell off,
`store: false`. Saved as 1024 px JPEG. Prompts, settings and latency are in `synthetic-faces.json`, with
no image data.

- `wrong-face.jpg`, text only: "A photorealistic head-and-shoulders portrait of an invented adult man,
  about 45 years old, short dark hair with some grey, light stubble, wearing a navy crew-neck sweater, calm
  expression, looking straight at the camera, plain light-grey studio background, soft even light. A
  fictional person who does not resemble any real or famous person. One person only."
- `two-people.jpg`, with `maya.jpg` and `wrong-face.jpg` as the first and second image: "Make one new photo
  of exactly these two people standing side by side in a sunlit café, in a square photo: the woman from the
  first photo and the man from the second photo. Keep each face as it is in their photo. Both face the
  camera, both faces fully visible and unobstructed, medium shot from the waist up, natural light. Two
  people only, nobody else."

The consent gate on them (local face counter, against the eval creator's reference photos), 2026-10-30:
`wrong-face.jpg` blocked FACE_MISMATCH, match 0.16 (threshold 0.35); `two-people.jpg` blocked
MULTIPLE_PEOPLE, "1 · Maya · 0.78" (the creator, green) and "2 · not licensed · 0.15" (red).
