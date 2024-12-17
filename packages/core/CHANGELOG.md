# Changelog
## 0.0.8 (2024-12-17)


### Fixes

* correctly set offsets when calling `define.str` function ([0422b57](https://github.com/suXinjke/cruncheevos/commit/0422b57552ca34547f4fae5cf5fdd0d2522fb608))

## 0.0.7 (2024-10-19)


### Features

* allow providing lvalue or rvalue as partial array to Condition.with and ConditionBuilder.withLast functions ([b8d83c4](https://github.com/suXinjke/cruncheevos/commit/b8d83c44364516bb1c03cd47ea13e8d3561415f1))

## 0.0.6 (2024-09-04)


### Features

* add `define.str` and `stringToNumberLE` functions to help generating conditions for comparing strings ([1468954](https://github.com/suXinjke/cruncheevos/commit/14689543c9fdf925549cbbebc9cb651be4b2ccfa))

## 0.0.5 (2024-08-04)


### Features

* add (+) (-) and (%) operators that are to be introduced with RAIntegration 1.4 ([d1f9214](https://github.com/suXinjke/cruncheevos/commit/d1f9214633ad1b1ae4f01cebd67e078e4f341d1b))
* add Remember flag, add Recall value type, which are to be introduced with RAIntegration 1.4 ([a3b7236](https://github.com/suXinjke/cruncheevos/commit/a3b723600398508f02c214f5d18766679eb10f8d))
* add [RichPresence utilities](https://github.com/suXinjke/cruncheevos/blob/master/packages/core/api-core.md#richpresenceparams-richpresenceparams) ([cad239c](https://github.com/suXinjke/cruncheevos/commit/cad239c6b41025804814fe8686ce3116a539106e))


### Fixes

* float values in leaderboard value conditions are now properly normalized ([00484fe](https://github.com/suXinjke/cruncheevos/commit/00484fe705f0ba1c93d876007ca34bba35e33264))
* implement parsing of v-syntax when dealing with legacy value format ([ffa2ead](https://github.com/suXinjke/cruncheevos/commit/ffa2eadcd3d3a12cff003ea76e65565347b2d81d))

## 0.0.4 (2024-06-12)


### Features

* add [ConditionBuilder.withLast](https://github.com/suXinjke/cruncheevos/blob/master/packages/core/define.md#withlast) function ([082823f](https://github.com/suXinjke/cruncheevos/commit/082823f3ef01d843b9dd75f4b7c94c397b533750))


### Fixes

* empty ConditionBuilder passed into define function is now properly ignored ([da3de12](https://github.com/suXinjke/cruncheevos/commit/da3de12b24ac582b53b7fc76ee93fe749f9d6d6e))

## 0.0.3 (2024-05-27)


### Fixes

* keep cmp and rvalue of leaderboard value conditions when decorated with Measured flag ([d559c81](https://github.com/suXinjke/cruncheevos/commit/d559c815a83750e5fe0f2ce511612f1c6c20c310))
* set correct CommonJS exported package name ([f0639ff](https://github.com/suXinjke/cruncheevos/commit/f0639ff6be24dc9cf11ef827699a6bce6ad1d241))
