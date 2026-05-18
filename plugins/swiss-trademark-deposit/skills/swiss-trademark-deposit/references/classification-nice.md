# Classification Nice

Use this reference for class selection and goods/services drafting.

## Drafting Funnel

1. Start with the official Nice heading or relevant part via `get_nice_heading` or `list_nice_headings`.
2. Search WDL terms using `search_wdl` with activity vocabulary and candidate classes.
3. Validate proposed labels with `validate_term`.
4. Calibrate granularity with Swissreg examples, `get_class_combinations`, and `get_sector_benchmark` from comparable sectors.
5. Add a limitation clause when the heading is broader than the activity.
6. Check the filing language: Swiss national applications require German, French, or Italian labels.

## Rules

- Do not invent labels without WDL or professional-source support.
- Use 8-15 labels for a main class when the activity is broad; more can be justified for multi-pillar businesses.
- Separate labels with semicolons.
- Draft labels in the user's working language, normally French for this plugin.
- Preserve source wording where possible.
- Avoid unsupported English-only output for Swiss national filings. If the client works in English, provide a working English explanation plus a filing-ready French, German, or Italian list.
- Treat empty or unsupported WDL rows as unusable. Do not draft from blank labels.

## Frequent Patterns

- Class 35 covers advertising, business management, administration, office functions, and retail/e-commerce services. Use it for commercialization of goods or services, but do not confuse it with delivery or the underlying service.
- Class 39 is not needed for ordinary e-commerce delivery unless the applicant provides logistics/transport services as a business activity.
- Class 41 covers education, training, entertainment, sporting, and cultural activities.
- Class 42 covers scientific/technological services, software as a service, design, development, and technical consulting.
- Class 43 covers restaurants, catering, temporary accommodation, food/drink provision, and often absorbs take-away/delivery aspects of prepared meals.
- Class 45 covers legal services and certain personal/security services.

## Limitations

Use clauses such as `tous les services precites etant limites au domaine ...` when the class heading is much broader than the activity. This reduces overbreadth and aligns the filing with real use.

## Versioning

Use the corpus-reported Nice version. For the current package, Nice is reported as `NCL(13-2026)` and must be verified against WIPO/IPI at filing time.
