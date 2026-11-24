# Fonts notice

Hue Harbor's **Text** preview embeds 36 typefaces so the app stays a single offline HTML file. Each is a **Latin subset, regular weight (400) only**, in WOFF2 form, taken from the [Fontsource](https://fontsource.org/) packages of the Google Fonts releases (`@fontsource/<id>@5`, file `<id>-latin-400-normal.woff2`). The subsets are stored base64-encoded inside `palette_picker.html` / `index.html` and decoded with the `FontFace` API only when a font is chosen; the originals live in `build/fonts/` with their metadata in `build/fonts/manifest.json`.

Total embedded font data: 780,052 bytes of WOFF2 (762 KB; about 1016 KB once base64-encoded).

Every font is free for commercial use. All are under the **SIL Open Font License 1.1** except **Roboto Slab**, which is under the **Apache License 2.0**. The full text of both licenses is at the end of this file. Hue Harbor itself is MIT-licensed (see `LICENSE`); the fonts keep their own licenses, and under the OFL the font software may not be sold by itself.

## Fonts

### Sans-serif & geometric

| Font | Designer(s) | License | Copyright | Subset size |
|---|---|---|---|---|
| [Inter](https://fonts.google.com/specimen/Inter) | Rasmus Andersson | OFL-1.1 | Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter) | 23,664 B |
| [Roboto](https://fonts.google.com/specimen/Roboto) | Christian Robertson, ParaType, Font Bureau | OFL-1.1 | Copyright 2011 The Roboto Project Authors (https://github.com/googlefonts/roboto-classic) | 21,884 B |
| [Open Sans](https://fonts.google.com/specimen/Open+Sans) | Steve Matteson | OFL-1.1 | Copyright 2020 The Open Sans Project Authors (https://github.com/googlefonts/opensans) | 18,640 B |
| [Lato](https://fonts.google.com/specimen/Lato) | Łukasz Dziedzic | OFL-1.1 | Copyright (c) 2010-2011 by tyPoland Lukasz Dziedzic (team@latofonts.com) with Reserved Font Name "Lato". Licensed under the SIL Open Font License, Version 1.1. | 23,580 B |
| [Montserrat](https://fonts.google.com/specimen/Montserrat) | Julieta Ulanovsky, Sol Matas, Juan Pablo del Peral, Jacques Le Bailly | OFL-1.1 | Copyright 2011 The Montserrat Project Authors (https://github.com/JulietaUla/Montserrat) | 18,780 B |
| [Poppins](https://fonts.google.com/specimen/Poppins) | Indian Type Foundry, Jonny Pinhorn, Ninad Kale | OFL-1.1 | Copyright 2020 The Poppins Project Authors (https://github.com/itfoundry/Poppins) | 7,884 B |
| [Nunito](https://fonts.google.com/specimen/Nunito) | Vernon Adams, Cyreal, Jacques Le Bailly | OFL-1.1 | Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito) | 16,316 B |
| [Work Sans](https://fonts.google.com/specimen/Work+Sans) | Wei Huang | OFL-1.1 | Copyright 2019 The Work Sans Project Authors (https://github.com/weiweihuanghuang/Work-Sans) | 19,900 B |
| [Raleway](https://fonts.google.com/specimen/Raleway) | Matt McInerney, Pablo Impallari, Rodrigo Fuenzalida | OFL-1.1 | Copyright 2010 The Raleway Project Authors (impallari@gmail.com), with Reserved Font Name "Raleway". | 22,408 B |
| [DM Sans](https://fonts.google.com/specimen/DM+Sans) | Colophon Foundry | OFL-1.1 | Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts) | 14,200 B |

### Serif & slab serif

| Font | Designer(s) | License | Copyright | Subset size |
|---|---|---|---|---|
| [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) | Claus Eggers Sørensen | OFL-1.1 | Copyright 2017 The Playfair Display Project Authors (https://github.com/clauseggers/Playfair-Display), with Reserved Font Name "Playfair Display". | 21,856 B |
| [Merriweather](https://fonts.google.com/specimen/Merriweather) | Sorkin Type | OFL-1.1 | Copyright 2024 The Merriweather Project Authors (https://github.com/EbenSorkin/Merriweather4) with Reserved Font Name "Merriweather". | 49,168 B |
| [Lora](https://fonts.google.com/specimen/Lora) | Cyreal | OFL-1.1 | Copyright 2011 The Lora Project Authors (https://github.com/cyrealtype/Lora-Cyrillic), with Reserved Font Name "Lora". | 21,148 B |
| [EB Garamond](https://fonts.google.com/specimen/EB+Garamond) | Georg Duffner, Octavio Pardo | OFL-1.1 | Copyright 2017 The EB Garamond Project Authors (https://github.com/octaviopardo/EBGaramond12) | 23,820 B |
| [Libre Baskerville](https://fonts.google.com/specimen/Libre+Baskerville) | Impallari Type | OFL-1.1 | Copyright 2012 The Libre Baskerville Project Authors (https://github.com/impallari/Libre-Baskerville) | 20,108 B |
| [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) | Christian Thalmann | OFL-1.1 | Copyright 2015 The Cormorant Project Authors (github.com/CatharsisFonts/Cormorant) | 22,876 B |
| [Roboto Slab](https://fonts.google.com/specimen/Roboto+Slab) | Christian Robertson | Apache-2.0 | Copyright 2018 The Roboto Slab Project Authors (https://github.com/googlefonts/robotoslab) | 13,968 B |
| [Arvo](https://fonts.google.com/specimen/Arvo) | Anton Koovit | OFL-1.1 | Copyright 2010 Anton Koovit. | 17,268 B |
| [Zilla Slab](https://fonts.google.com/specimen/Zilla+Slab) | Typotheque | OFL-1.1 | Copyright 2017, The Mozilla Foundation | 26,468 B |
| [Bitter](https://fonts.google.com/specimen/Bitter) | Sol Matas | OFL-1.1 | Copyright 2011 The Bitter Project Authors (https://github.com/solmatas/BitterPro) | 18,568 B |

### Monospace

| Font | Designer(s) | License | Copyright | Subset size |
|---|---|---|---|---|
| [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) | JetBrains, Philipp Nurullin, Konstantin Bulenkov | OFL-1.1 | Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono) | 21,168 B |
| [Fira Code](https://fonts.google.com/specimen/Fira+Code) | The Mozilla Foundation, Telefonica S.A., Nikita Prokopov | OFL-1.1 | Copyright 2014-2020 The Fira Code Project Authors (https://github.com/tonsky/FiraCode) | 23,312 B |
| [Source Code Pro](https://fonts.google.com/specimen/Source+Code+Pro) | Paul D. Hunt | OFL-1.1 | Copyright 2010, 2012 Adobe Systems Incorporated (http://www.adobe.com/), with Reserved Font Name "Source" | 11,656 B |
| [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) | Mike Abbink, Bold Monday | OFL-1.1 | Copyright 2017 IBM Corp. All rights reserved. | 14,708 B |
| [Space Mono](https://fonts.google.com/specimen/Space+Mono) | Colophon Foundry | OFL-1.1 | Copyright 2016 The Space Mono Project Authors (https://github.com/googlefonts/spacemono) | 16,520 B |

### Script & handwritten

| Font | Designer(s) | License | Copyright | Subset size |
|---|---|---|---|---|
| [Pacifico](https://fonts.google.com/specimen/Pacifico) | Vernon Adams, Jacques Le Bailly, Botjo Nikoltchev, Ani Petrova | OFL-1.1 | Copyright 2018 The Pacifico Project Authors (https://github.com/googlefonts/Pacifico) | 32,280 B |
| [Dancing Script](https://fonts.google.com/specimen/Dancing+Script) | Impallari Type | OFL-1.1 | Copyright 2016 The Dancing Script Project Authors (https://github.com/googlefonts/DancingScript), with Reserved Font Name 'Dancing Script'. | 23,816 B |
| [Caveat](https://fonts.google.com/specimen/Caveat) | Impallari Type | OFL-1.1 | Copyright 2014 The Caveat Project Authors (https://github.com/googlefonts/caveat) | 48,836 B |
| [Great Vibes](https://fonts.google.com/specimen/Great+Vibes) | Robert Leuschke | OFL-1.1 | Copyright 2010 The Great Vibes Pro Project Authors (https://github.com/googlefonts/great-vibes) | 42,800 B |
| [Kalam](https://fonts.google.com/specimen/Kalam) | Indian Type Foundry | OFL-1.1 | Copyright (c) 2014 Indian Type Foundry (info@indiantypefoundry.com) | 22,336 B |

### Display

| Font | Designer(s) | License | Copyright | Subset size |
|---|---|---|---|---|
| [Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue) | Ryoichi Tsunekawa | OFL-1.1 | Copyright 2019 The Bebas Neue Project Authors (https://github.com/dharmatype/Bebas-Neue) | 13,768 B |
| [Lobster](https://fonts.google.com/specimen/Lobster) | Impallari Type | OFL-1.1 | Copyright 2010 The Lobster Project Authors (https://github.com/impallari/The-Lobster-Font), with Reserved Font Name "Lobster". | 33,844 B |
| [Abril Fatface](https://fonts.google.com/specimen/Abril+Fatface) | TypeTogether | OFL-1.1 | Copyright (c) 2011, Copyright (c) 2011, TypeTogether (www.type-together.com info@type-together.com), with Reserved Font Names "Abril" and "Abril Fatface" | 13,156 B |
| [Righteous](https://fonts.google.com/specimen/Righteous) | Astigmatic | OFL-1.1 | Copyright (c) 2011 by Brian J. Bonislawsky DBA Astigmatic (AOETI) (astigma@astigmatic.com), with Reserved Font Name "Righteous" | 12,756 B |
| [Oswald](https://fonts.google.com/specimen/Oswald) | Vernon Adams, Kalapi Gajjar, Cyreal | OFL-1.1 | Copyright 2016 The Oswald Project Authors (https://github.com/googlefonts/OswaldFont) | 12,248 B |
| [Bungee](https://fonts.google.com/specimen/Bungee) | David Jonathan Ross | OFL-1.1 | Copyright 2023 The Bungee Project Authors (https://github.com/djrrb/Bungee) | 14,344 B |

Reserved Font Names: several OFL fonts declare a Reserved Font Name (for example "Inter", "Lato", "EB Garamond"). Hue Harbor does not modify or rename any font; the subsetting was done by the Fontsource project and the files are used unchanged under the family names above.

## SIL Open Font License, Version 1.1

```
-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

## Apache License, Version 2.0 (Roboto Slab)

```
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```
