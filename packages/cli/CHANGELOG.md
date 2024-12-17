# Changelog
## 0.0.8 (2024-12-17)


### Features

* add warnings for long asset title and description length ([8a08e17](https://github.com/suXinjke/cruncheevos/commit/8a08e178d0f7252e908509e3828bf8a573e8a908))

## 0.0.7 (2024-10-19)


### Fixes

* --include-unofficial and --exclude-unofficial options now account for hidden leaderboards ([0cfbd75](https://github.com/suXinjke/cruncheevos/commit/0cfbd7521f5a6e8e0f8a6a2a729d2f4f928b4955))

## 0.0.6 (2024-09-04)


### Features

* commands save, diff, diff-save now compare against unofficial achievement by default, use --exclude-unofficial option instead of --include-unofficial ([c11ce99](https://github.com/suXinjke/cruncheevos/commit/c11ce994ddfe8fc42f1bb5cc19eadc4dfd79e162))


### Fixes

* correctly preserve IDs of local assets, avoiding a situation when `save` command wold result in assets having same IDs ([3b0a662](https://github.com/suXinjke/cruncheevos/commit/3b0a66227d6e81cd9fd0f446622513afb51a2408))

## 0.0.5 (2024-08-04)


### Features

* add rich-save command ([2193ac1](https://github.com/suXinjke/cruncheevos/commit/2193ac19a0c55d11a2cc07be59716b9b2fe92b5e))

## 0.0.4 (2024-06-12)


### Fixes

* explicitly show alt groups without conditions being added or removed when using diff command ([484a8c9](https://github.com/suXinjke/cruncheevos/commit/484a8c9abbc7a6abb06293ba8e2f75efe392a17a))

## 0.0.3 (2024-05-27)


### Fixes

* generate command prompts for overwriting the file ([#3](https://github.com/suXinjke/cruncheevos/issues/3)) ([f216378](https://github.com/suXinjke/cruncheevos/commit/f2163788372c4279f606ed4943d92170405e9454))
* if badge is not explicitly set - preserve original badge set on server ([#2](https://github.com/suXinjke/cruncheevos/issues/2)) ([8b889c9](https://github.com/suXinjke/cruncheevos/commit/8b889c977634caa0ba92a471c905c93b712bf957))
