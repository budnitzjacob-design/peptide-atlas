# Review Queue

Generated: 2026-04-27T07:58:15.465Z

Counts: 48 regulatory rows, 11 PK audit targets, 41 price scrape targets, 186 collected price observations.

## Queue

- [HIGH] 5-Amino-1-methylquinolinium :: pk_normalization
  blocker: volume_of_distribution|vd_units|vd_population|phase2_metabolism
  targets: 4 | next: https://pubmed.ncbi.nlm.nih.gov/34304009/
  notes: Existing atlas record already cites Neelakantan 2018 and Phelps 2021. Vd not reported in either source; population-level human PK absent.
- [HIGH] Cerebrolysin :: pk_normalization
  blocker: volume_of_distribution|vd_units|vd_population|phase1_metabolism|phase2_metabolism
  targets: 5 | next: https://www.everpharma.com/products/cerebrolysin/
  notes: Mixture of low-MW neuropeptides (~25%) and free amino acids (~75%) from enzymatic porcine brain hydrolysate. Project rule: do not force single-molecule PK fields onto a mixture. EVER Pharma SmPC does not publish a normalized Vd/first-pass; component-level metabolism follows general proteolysis and amino-acid metabolism.
- [HIGH] Human chorionic gonadotropin :: pk_normalization
  blocker: volume_of_distribution|vd_units|vd_population
  targets: 7 | next: https://www.accessdata.fda.gov/drugsatfda_docs/label/2023/017692s028s036s043lbl.pdf
  notes: FDA-approved IM. Distinct from recombinant choriogonadotropin alfa (Ovidrel). Pregnyl marketing start 2004-02-18 per DailyMed; underlying NDA 017692 originally approved much earlier (urine-derived hCG has been marketed since the 1960s).
- [HIGH] Ibutamoren :: pk_normalization
  blocker: volume_of_distribution|vd_units|vd_population|first_pass
  targets: 6 | next: https://pubmed.ncbi.nlm.nih.gov/7624358/
  notes: No published human Vd in the cited primary literature. First-pass extraction inferred from oral bioavailability data but not normalized as a single value.
- [HIGH] Liraglutide :: pk_normalization
  blocker: phase2_metabolism
  targets: 14 | next: https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/liraglutide-marketed-victoza-information
  notes: Pharmacokinetic profile suitable for once-daily SC dosing driven by self-association at the injection site, >98% plasma protein binding, and DPP-4/NEP resistance. Absolute SC bioavailability ~55%. Not the same setid as Victoza (already in atlas).
- [HIGH] Retatrutide :: pk_normalization
  blocker: volume_of_distribution|vd_units|vd_population
  targets: 7 | next: https://www.cell.com/cell-metabolism/fulltext/S1550-4131(22)00299-5
  notes: Phase 1/1b PK papers (Coskun 2022 Cell Metab; Urva 2022 Lancet) report dose-proportional PK, t1/2 ~6 days supporting once-weekly subcutaneous dosing, and Tmax 12-72 h. Volume of distribution is NOT publicly reported in the abstracts/main texts of the published Phase 1 or Phase 2 trials; left null. No FDA-approved label exists yet (April 2026).
- [HIGH] Teduglutide :: pk_normalization
  blocker: phase2_metabolism
  targets: 7 | next: https://www.accessdata.fda.gov/drugsatfda_docs/label/2023/203441s013lbl.pdf
  notes: Body weight is a significant covariate of Vd; CL/F ~18% higher in males vs females (12.4 vs 10.5 L/h). Pre-existing atlas Gattex DailyMed citation retained; this row adds the EMA Revestive marketing authorization and Marier 2010 population PK paper. CAVEAT: the specific Vd 103 mL/kg value attributed to Gattex/Revestive labels could not be re-verified from the Marier 2010 abstract alone; full-text Marier 2010 (J Clin Pharmacol PMID 19773525) or direct DailyMed/EMA SmPC paragraph confirmation recommended before treating this Vd as fully source-locked.
- [HIGH] BPC-157 :: price_capture
  blocker: No direct product pricing captured yet.
  targets: 6 | next: https://www.finnrick.com/products/bpc-157/peptide-partners
  notes: Collect direct product pricing here first; fall back to Finnrick-derived quality context if direct product pricing is unavailable.
- [HIGH] Retatrutide :: price_capture
  blocker: No direct product pricing captured yet.
  targets: 6 | next: https://www.finnrick.com/products/retatrutide/peptide-partners
  notes: Collect direct product pricing here first; fall back to Finnrick-derived quality context if direct product pricing is unavailable.
- [HIGH] Tesamorelin :: price_capture
  blocker: No direct product pricing captured yet.
  targets: 6 | next: https://www.finnrick.com/products/tesamorelin/peptide-partners
  notes: Collect direct product pricing here first; fall back to Finnrick-derived quality context if direct product pricing is unavailable.
- [MEDIUM] 5-Amino-1-methylquinolinium :: price_capture
  blocker: No direct product pricing captured yet.
  targets: 4 | next: https://ascensionpeptides.com/product/5-amino-1mq-10-mg/
  notes: Useful vendor-quality page to pair with future direct price captures.
- [MEDIUM] Cerebrolysin :: price_capture
  blocker: No direct product pricing captured yet.
  targets: 1
  notes: No vendor-quality rows embedded for this tracked peptide; manual product-source discovery required.
- [MEDIUM] Human chorionic gonadotropin :: price_capture
  blocker: No direct product pricing captured yet.
  targets: 2 | next: https://ascensionpeptides.com/product/hcg-5000iu/
  notes: Useful vendor-quality page to pair with future direct price captures.
- [MEDIUM] Ibutamoren :: price_capture
  blocker: No direct product pricing captured yet.
  targets: 2 | next: https://limitlesslifenootropics.com/product/mk-677-12-5mg-60-capsules/
  notes: Useful vendor-quality page to pair with future direct price captures.
- [MEDIUM] Liraglutide :: price_capture
  blocker: No direct product pricing captured yet.
  targets: 1
  notes: No vendor-quality rows embedded for this tracked peptide; manual product-source discovery required.
- [MEDIUM] Semaglutide :: price_capture
  blocker: No direct product pricing captured yet.
  targets: 6 | next: https://www.finnrick.com/products/semaglutide/bulk-peptide-wholesale
  notes: Useful vendor-quality page to pair with future direct price captures.
- [MEDIUM] Teduglutide :: price_capture
  blocker: No direct product pricing captured yet.
  targets: 1
  notes: No vendor-quality rows embedded for this tracked peptide; manual product-source discovery required.
- [MEDIUM] Tirzepatide :: price_capture
  blocker: No direct product pricing captured yet.
  targets: 6 | next: https://www.finnrick.com/products/tirzepatide/trusted-peptide
  notes: Useful vendor-quality page to pair with future direct price captures.
