[33mcommit 657cc30e2f2171c3346c88124523a6feee13d15b[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmain[m[33m, [m[1;31morigin/main[m[33m, [m[1;31morigin/HEAD[m[33m)[m
Author: mancavesports3024 <mancavesportscardsllc@gmail.com>
Date:   Thu Aug 28 16:42:45 2025 -0500

    Fix Malik Nabers extraction by adding early return and filtering CB-MNS

[1mdiff --git a/backend/create-new-pricing-database.js b/backend/create-new-pricing-database.js[m
[1mindex 3fa7497..6d8b3fc 100644[m
[1m--- a/backend/create-new-pricing-database.js[m
[1m+++ b/backend/create-new-pricing-database.js[m
[36m@@ -2708,6 +2708,14 @@[m [mclass NewPricingDatabase {[m
             return 'Xavier Worthy';[m
         }[m
         [m
[32m+[m[32m        // Look for "Malik Nabers" in various contexts[m
[32m+[m[32m        const malikNabersPattern = /\b(Malik\s+Nabers)\b/gi;[m
[32m+[m[32m        const malikNabersMatch = cleanTitle.match(malikNabersPattern);[m
[32m+[m[32m        if (malikNabersMatch && malikNabersMatch.length > 0) {[m
[32m+[m[32m            if (debugOn) this._lastDebug = steps.concat([{ step: 'malikNabersEarlyReturn', result: 'Malik Nabers' }]);[m
[32m+[m[32m            return 'Malik Nabers';[m
[32m+[m[32m        }[m
[32m+[m[41m        [m
         // Look for "Cooper Flagg" in various contexts[m
         const cooperFlaggPattern = /\b(Cooper\s+Flagg)\b/gi;[m
         const cooperFlaggMatch = cleanTitle.match(cooperFlaggPattern);[m
[36m@@ -3540,7 +3548,7 @@[m [mclass NewPricingDatabase {[m
             'yellow', 'green', 'blue', 'red', 'black', 'silver', 'gold', 'white',[m
             'refractor', 'x-fractor', 'cracked ice', 'stained glass', 'die-cut', 'die cut',[m
             'holo', 'holographic', 'prizm', 'chrome', 'base', 'sp', 'ssp', 'short print',[m
[31m-            'super short print', 'parallel', 'insert', 'numbered', 'limited', 'au', 'auto', 'autograph', 'autographs', 'edition', 'sublime', 'shimmer', 'scripts', 'ref', 'reptilian', 'storm', 'zone', 'sunday', 'pop', 'chasers', 'busters', 'reactive', 'reprint', 'king', 'dallas', 'snake', 'rainbow', 'go hard go', 'go hard go home', 'home', 'royal blue', 'gold rainbow', 'holiday', 'yellow', 'aqua', 'silver crackle', 'yellow rainbow', 'jack o lantern', 'ghost', 'gold', 'blue holo', 'purple holo', 'green crackle', 'orange crackle', 'red crackle', 'vintage stock', 'independence day', 'black', 'fathers day', 'mothers day', 'mummy', 'yellow crackle', 'memorial day', 'black cat', 'clear', 'witches hat', 'bats', 'first card', 'platinum', 'printing plates', 'royal', 'blue', 'vintage', 'stock', 'independence', 'day', 'fathers', 'mothers', 'memorial', 'cat', 'witches', 'hat', 'lantern', 'crackle', 'holo', 'foilboard', 'rookies', 'radiating', 'now', 'foil', 'ucl', 'preview', 'shock', 'design'[m
[32m+[m[32m            'super short print', 'parallel', 'insert', 'numbered', 'limited', 'au', 'auto', 'autograph', 'autographs', 'edition', 'sublime', 'shimmer', 'scripts', 'ref', 'reptilian', 'storm', 'zone', 'sunday', 'pop', 'chasers', 'busters', 'reactive', 'reprint', 'king', 'dallas', 'snake', 'rainbow', 'go hard go', 'go hard go home', 'home', 'royal blue', 'gold rainbow', 'holiday', 'yellow', 'aqua', 'silver crackle', 'yellow rainbow', 'jack o lantern', 'ghost', 'gold', 'blue holo', 'purple holo', 'green crackle', 'orange crackle', 'red crackle', 'vintage stock', 'independence day', 'black', 'fathers day', 'mothers day', 'mummy', 'yellow crackle', 'memorial day', 'black cat', 'clear', 'witches hat', 'bats', 'first card', 'platinum', 'printing plates', 'royal', 'blue', 'vintage', 'stock', 'independence', 'day', 'fathers', 'mothers', 'memorial', 'cat', 'witches', 'hat', 'lantern', 'crackle', 'holo', 'foilboard', 'rookies', 'radiating', 'now', 'foil', 'ucl', 'preview', 'shock', 'design', 'cb-mns', 'cb mns', 'cbms'[m
         ];[m
         [m
         let cleanName = playerName;[m
