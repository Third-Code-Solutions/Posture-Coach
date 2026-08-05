# Dependency and model provenance

Reviewed 2026-08-05 for the local MVP.

| Asset                      | Version/source                                                                                                                                              | License                                          | Purpose                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------- |
| Next.js                    | `15.5.22`                                                                                                                                                   | MIT                                              | Static React application build               |
| React / React DOM          | `19.2.8`                                                                                                                                                    | MIT                                              | UI runtime                                   |
| `@mediapipe/tasks-vision`  | `1.0.1`                                                                                                                                                     | Apache 2.0                                       | Browser Pose Landmarker API and Wasm runtime |
| Pose Landmarker Full model | `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`, downloaded into `public/models` | Apache 2.0 per the official BlazePose model card | On-device single-person pose landmarks       |
| Tailwind CSS               | `4.3.3`                                                                                                                                                     | MIT                                              | CSS tooling                                  |
| Vitest                     | `4.1.10`                                                                                                                                                    | MIT                                              | Domain tests                                 |
| Playwright                 | `1.62.1`                                                                                                                                                    | Apache 2.0                                       | Browser smoke tooling                        |
| serve                      | `14.2.6`                                                                                                                                                    | MIT                                              | Local static-output preview server           |

Official sources:

- [Pose Landmarker Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
- [Pose Landmarker overview and model table](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)
- [Official MediaPipe repository](https://github.com/google-ai-edge/mediapipe)
- [Official browser samples](https://github.com/google-ai-edge/mediapipe-samples-web)
- [BlazePose GHUM 3D model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)

## Integrity records

- `public/models/pose_landmarker_full.task` SHA-256: `4EAA5EB7A98365221087693FCC286334CF0858E2EB6E15B506AA4A7ECDCEC4AD`
- `public/wasm/vision_wasm_internal.js` SHA-256: `E170EE67DD4E16C1A6FCD8840A206687E5A59B22C20E4A902BC445B095454D73`
- `public/wasm/vision_wasm_internal.wasm` SHA-256: `8DA277A733926EACD0474B8704B36742D6EC3231C57A860C5B889DFF8F1DF886`
- `public/wasm/vision_wasm_module_internal.js` SHA-256: `DA8934057F147B622E82CFB4C0DBD85461C598E268588B5A8BA9CA963A8FF82D`
- `public/wasm/vision_wasm_module_internal.wasm` SHA-256: `2DABD8E23C60984628BEB7BB338764C81A08E6837145273F59578684B5D53C1B`
- `public/wasm/vision_wasm_nosimd_internal.js` SHA-256: `E81D715A3D42CC3373602EB2F7AFF795D164934DB680E32496B65DAB537F9658`
- `public/wasm/vision_wasm_nosimd_internal.wasm` SHA-256: `A28483CD42E74E855BF5EBDB6B40D9B66A5B49E35E95020BC97669E6822A3192`

The model card describes the Full model as intended for browser/mobile single-person pose estimation and explicitly lists fitness/repetition counting as an intended use while excluding life-critical decisions. That limitation is reflected in the product disclaimer.
