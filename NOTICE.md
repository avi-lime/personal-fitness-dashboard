# Notices

Life Dashboard — Copyright (C) 2026 avi-lime.

This program is free software: you can redistribute it and/or modify it under the terms of the
**GNU Affero General Public License v3.0 or later** (see [LICENSE](LICENSE)). Because it is a
network service, anyone using a running copy is entitled to its source: the app links to this
repository from its menu.

## openGym

Parts of the training features are ported from [**openGym**](https://github.com/DuarteSantos8/openGym)
by Duarte Santos, licensed under the AGPL v3.0 — notably the workout-history CSV importer
(Strong, Hevy, FitNotes), the set model for warm-ups and drop sets, supersets, the progression
schemes and the exercise catalogue's text. They were adapted to this codebase rather than copied
verbatim, and remain under the AGPL.

openGym's exercise **media** (stills and animations, © Gym visual) is licensed separately, is not
covered by the AGPL, and is **not** used here.

## Body diagram geometry

The muscle outlines of the body map are derived, via openGym, from
[**MuscleMap**](https://github.com/melihcolpan/MuscleMap) by Melih Colpan, under the MIT License:

```
MIT License

Copyright (c) 2026 Melih Colpan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Exercise text

Catalogue entries marked `exercisedb` in openGym originate from [**ExerciseDB v1**](https://exercisedb.dev/)
by AscendAPI, via [**hasaneyldrm/exercises-dataset**](https://github.com/hasaneyldrm/exercises-dataset),
under the MIT License (Copyright (c) 2026 Hasan Emir Yıldırım; same terms as above). The rest of the
catalogue's text was written for openGym and is used under the AGPL v3.0.
