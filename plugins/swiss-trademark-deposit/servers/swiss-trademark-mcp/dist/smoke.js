import { SwissTrademarkCorpus } from "./db.js";
const corpus = new SwissTrademarkCorpus();
const checks = {
    get_nice_heading: corpus.getNiceHeading({ class_number: 43 }),
    search_wdl: corpus.wdlSearchTerms({ query: "traiteurs", classes: [43], limit: 5 }),
    validate_term: corpus.validateWdlTerm({ class_number: 43, term: "services de traiteurs" }),
    search_swissreg_terms: corpus.searchSwissregTerms({ query: "Halbleiter", nice_class: 9, limit: 5 }),
    get_sector_benchmark: corpus.getSwissregSectorBenchmark({ nice_class: 9, limit: 5 }),
    search_taf_decisions: corpus.tafSearchPrecedents({
        query: "capsule medicament",
        articles: ["Art. 2 let. a LPM"],
        classes: [5],
        risk_tags: ["shape_3d"],
        limit: 5,
    }),
    get_taf_decision: corpus.tafGetDecision({ reference: "B-3601/2014" }),
    find_similar_signs: corpus.findSimilarTafSigns({ sign: "APP STORE", sign_type: "verbal", nice_classes: [9], limit: 3 }),
    clearance_search_plan: corpus.clearanceSearchPlan({
        sign: "SWISS AI",
        classes: [42],
        goods_services: ["logiciels en tant que service (SaaS)"],
    }),
    sign_risk_screen: corpus.signRiskScreen({
        sign: "SWISS AI",
        classes: [42],
        goods_services: ["conseil en intelligence artificielle"],
    }),
    filing_requirements_snapshot: corpus.filingRequirementsSnapshot({ classes_count: 4, electronic: true }),
    corpus_stats: corpus.corpusStats(),
};
console.log(JSON.stringify(checks, null, 2));
corpus.close();
