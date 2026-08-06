# Dependency and model provenance

Reviewed 2026-08-05 for the local MVP.

The no-WebGL fallback is vendored locally: `@tensorflow-models/pose-detection@2.1.3` with TensorFlow.js core, converter, and WASM backend `4.22.0`. Its BlazePose Full detector and landmark weights live under `public/models/blazepose-tfjs`; the three WASM binaries live under `public/tfjs-wasm`. All fallback requests are same-origin and remain on-device.

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
- [TensorFlow.js pose-detection repository](https://github.com/tensorflow/tfjs-models/tree/master/pose-detection)
- [MediaPipe BlazePose model artifacts](https://www.kaggle.com/models/mediapipe/blazepose-3d)
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
- `public/models/blazepose-tfjs/detector/model.json` SHA-256: `E7D678947790BA0578A5851FDB3CF70858A936FE09B9FE83E3D8CA6CE15F3567`
- `public/models/blazepose-tfjs/detector/group1-shard1of2.bin` SHA-256: `C8D4EBFDCC6CB893F8CC6929CE2D2DFADC561E359D159E1AEB49B3F9EB034D98`
- `public/models/blazepose-tfjs/detector/group1-shard2of2.bin` SHA-256: `F2A8EAC1426DD73F250D48DEE0295DE0730A5559DFD713236EEF2E44861EF835`
- `public/models/blazepose-tfjs/landmark-full/model.json` SHA-256: `03676A196FAF7C3FC26C0E4A434C5C20724606570240D47543DC290D1363D8E4`
- `public/models/blazepose-tfjs/landmark-full/group1-shard1of2.bin` SHA-256: `16946F8B831D1B54DE38F87D26B6EF401BAA985DA1DF9DD188086F2528208502`
- `public/models/blazepose-tfjs/landmark-full/group1-shard2of2.bin` SHA-256: `1C5653AF7D08E4246A74755870CF1B7D5524AE4C90A4A7280D10C11400E36A40`
- `public/tfjs-wasm/tfjs-backend-wasm.wasm` SHA-256: `70A5D516060464E5269F01C74BAC1772D6B8AB6CB612ACF16B5CDAF61F78D892`
- `public/tfjs-wasm/tfjs-backend-wasm-simd.wasm` SHA-256: `77EBB28A6D34F371DBBF2086B7F2DE8994ACD8EA5A3CF1FA24D2C26C840CAC7B`
- `public/tfjs-wasm/tfjs-backend-wasm-threaded-simd.wasm` SHA-256: `C052228D4BEF185C27BBE59A9E029570C78BBB9F08B3CB46B597851650373DE2`

The model card describes the Full model as intended for browser/mobile single-person pose estimation and explicitly lists fitness/repetition counting as an intended use while excluding life-critical decisions. That limitation is reflected in the product disclaimer.
