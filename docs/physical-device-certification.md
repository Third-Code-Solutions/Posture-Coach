# Physical-device certification

Use this protocol before claiming support for a named phone/browser combination. Automated emulation proves app control flow and layout. It does not prove a physical sensor, browser permission shell, field of view, thermal state, or camera driver.

## Required matrix

Run current production HTTPS on:

- current Safari on one smaller and one larger supported iPhone;
- current Chrome on one low/mid-tier and one recent Android phone;
- Firefox Android when Firefox mobile support is claimed;
- any installed-web-app or in-app-browser shell only when that shell is explicitly in scope.

Record device model, OS version, browser name/version, production URL, date, lighting, battery-saver state, and whether another app initially held the camera. Do not record a person or save frames for this protocol.

## Core run

1. Open production in a normal private tab. Confirm page fits portrait viewport with no horizontal scroll.
2. Open Device readiness. Reset check before camera start.
3. Deny camera once. Confirm clear local-video fallback, no frozen requesting state, and no camera indicator.
4. Allow front camera. Keep phone upright. Confirm inline portrait preview, mirrored front view, responsive controls, and visible live local-engine/latency state.
5. Place phone far enough away for head and both feet. Hold a relaxed standing pose until local overlay remains stable.
6. Calibrate. Confirm coaching stays paused when view, confidence, or full-body framing is insufficient.
7. Switch to rear camera. Confirm old camera indicator/track stops, rear preview is unmirrored, and effective frame remains portrait even when decoded source is landscape.
8. Background and foreground the browser once. Confirm camera stops when hidden and requires an explicit restart.
9. Restart, run at least ten minutes, rotate device once, lock/unlock once, and observe responsiveness, thermal behavior, and alignment.
10. Stop session. Confirm camera indicator turns off. Download device report from Device readiness.

Repeat key front/rear/full-body steps in low light, battery saver, and camera-in-use conditions. Exercise standing front and side views plus every movement mode supported by its declared view.

## Report acceptance

Inspect downloaded JSON. Required for a passing core run:

- `privacy.localOnly`, `containsFrames: false`, `containsLandmarks: false`, and `containsDeviceIdentifiers: false`;
- secure context, camera API, local inference, camera permission, portrait frame, live pose, latency, and camera cleanup checks marked `observed`;
- `cameraPermissionOutcomes.denied` and `cameraPermissionOutcomes.granted` each at least one when completing the deny-then-allow protocol;
- both `user` and `environment` in `cameraFacingsTested` when hardware exposes both lenses;
- matching sanitized entries in `cameraRuntimesByFacing`, with effective height at least effective width for every tested lens;
- nonzero local pose results and finite p50/p95/max latency;
- `full-body-framing` marked `observed` for full-body coaching;
- `cameraCleanupConfirmed: true` after stop;
- no `deviceId`, `groupId`, frames, landmarks, or personal data.

`check` or `not-tested` is not a pass. Preserve the JSON with a separate named-device test record. Never edit the report to turn an unobserved check into a pass.

## External observations

The local report cannot inspect DevTools outside its own runtime. Record separately:

- console errors and warnings;
- failed requests and any request leaving production origin;
- overlay alignment at head, shoulders, hips, knees, ankles, and feet;
- permission prompt, camera indicator, front/rear switch, background/foreground, and stop behavior;
- measured room distance needed for a full body;
- visible freezes, dropped responsiveness, memory growth, and thermal throttling.

Any unexpected external request, retained camera indicator, repeated frame/overlay misalignment, unhandled error, or inability to fit required landmarks fails that named device run.

## Release boundary

A passing run certifies only recorded device, OS, browser, orientation, and conditions. It is operational compatibility evidence, not medical validation, clinical accuracy, zero-delay proof, or support for every device. Keep product language educational and retain abstention when evidence is weak.
