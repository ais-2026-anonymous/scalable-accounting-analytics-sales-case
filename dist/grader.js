// Rubric and feedback schema only. Python owns every runtime score.
// No workbook execution, student code evaluation, or network calls occur here.
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const ALL_TAXONOMY = [
 ['missing','Incomplete answer','An assessed answer cell is blank.','Complete the highlighted answer cell using a calculation from your analysis.','workflow'],
 ['excel_error','Spreadsheet calculation error','The saved answer contains an Excel error.','Trace the formula precedents and resolve the error in Excel before saving again.','workflow'],
 ['uncached','Formula result unavailable','A formula is present, but the file has no saved result. This is not evidence of an accounting mistake.','Recalculate and save the workbook in desktop Excel, then select the saved file again.','workflow'],
 ['units_for_revenue','Units used for revenue','The answer matches monthly units instead of monthly dollar sales.','Check the units of the requested output. Aggregate the revenue column for the specified product and year-month.','aggregation'],
 ['cross_year','Same month pooled across years','The answer matches all occurrences of that calendar month across the ten-year dataset.','Use both year and month in the filter. February 2012 is one period, not every February.','aggregation'],
 ['average_for_total','Average used for total','The answer matches average daily revenue rather than monthly total revenue.','Check whether the question requests an average or a total and review the aggregation operation.','aggregation'],
 ['wrong_product','Product columns mixed','The answer matches the other product for the requested month.','Trace the product label through the sales, claims, and answer columns.','mapping'],
 ['wrong_period','Adjacent period selected','The answer matches a neighboring sales month.','Check date boundaries, including the year and the first day of the next month.','mapping'],
 ['inverted_price','Price ratio inverted','The answer matches units divided by revenue.','Write down the units: dollars divided by units produces dollars per unit.','pricing'],
 ['same_month','Claim booking month mistaken for sales cohort','The answer matches claims booked in the sales month divided by that month’s units.','Returns from sales in t are booked in t+1; warranties from sales in t are booked in t+2. Trace one cohort.','timing'],
 ['prior_cohort','Answer describes the prior cohort','The answer matches claims booked in t divided by sales in t minus the policy lag.','That can describe an earlier cohort correctly, but the answer cell asks about sales originating in the specified month.','timing'],
 ['one_month_warranty','One-month lag used for warranty','The answer matches next-month warranty claims divided by current sales.','Warranty claims in this case are booked two months after the originating sale.','timing'],
 ['revenue_denominator','Dollar sales used in a unit claim rate','The answer matches the correct claim count divided by revenue.','The numerator counts products. Use originating units sold so numerator and denominator have compatible units.','rates'],
 ['net_units','Returns deducted from the denominator','The answer matches claims divided by units remaining after returns.','The case’s technical answer uses original units sold, rather than units net of later returns.','rates'],
 ['count_for_rate','Claim count reported as a rate','The answer matches a claim count rather than its proportion of originating sales.','Divide the matched claim count by units sold in the originating sales month.','rates'],
 ['percent_scale','Percentage scale mismatch','The answer is consistent with a factor-of-100 conversion error.','8.38% and 0.0838 are equivalent. The number 8.38 without a percent sign represents 838%.','representation'],
 ['month_format','Clearance month representation','The answer uses a number or abbreviated month instead of the requested full month name.','Use the complete English month name, such as September, as specified in the case.','representation'],
 ['clearance','Clearance period identification','The submitted month does not match the recurring lower-price month in this dataset.','Calculate monthly revenue divided by monthly units. Look for the recurring reduction in selling price.','policy'],
 ['unknown','Method needs investigation','The answer differs, but it does not uniquely match a supported mistake pattern.','Trace the calculation from source data. An incorrect number alone does not identify the method used.','review'],
 ['unobserved','Unobserved future claims versus actual zeros','Late sales cohorts do not yet have observable future claims at the end of the dataset.','Do not include those unobserved outcomes as zero when estimating historical rates.','policy'],
 ['clearance_policy','Return eligibility versus warranty coverage','Clearance sales cannot be returned but retain warranty coverage under this case’s policy.','Exclude clearance cohorts when estimating return-eligible rates; retain appropriate warranty observations.','policy'],
 ['pooled_rates','Product-specific estimates','Pooling products can hide differences in claim experience.','Estimate and justify a separate return and warranty rate for each product.','judgment'],
 ['chart_units','Counts, rates, units, and dollars','A graph’s meaning depends on its units and denominator.','Label quantities and revenue separately, and use matched claim rates to compare claim experience.','communication'],
 ['unsupported_inference','Evidence and causal claims','A pattern in these simulated data does not by itself establish a business cause.','Distinguish the observed pattern from possible explanations and identify what further evidence you need.','judgment'],
].map(([id,title,description,hint,category])=>({id,title,description,hint,category}));
export const TAXONOMY=ALL_TAXONOMY.filter(x=>!['unobserved','clearance_policy','pooled_rates','chart_units','unsupported_inference'].includes(x.id));
export const ITEMS = [
 ['B7','Monthly revenue · Product A','aggregation','A','2012-02','revenue'],
 ['B8','Monthly revenue · Product B','aggregation','B','2019-12','revenue'],
 ['B12','Average selling price · Product A','pricing','A','2012-02','price'],
 ['B13','Average selling price · Product B','pricing','B','2019-12','price'],
 ['B14','Clearance month · Product A','clearance','A',null,'month'],
 ['B15','Clearance month · Product B','clearance','B',null,'month'],
 ['B19','Return rate · Product A','returns','A','2012-02','return'],
 ['B20','Return rate · Product B','returns','B','2019-12','return'],
 ['B24','Warranty rate · Product A','warranties','A','2012-02','warranty'],
 ['B25','Warranty rate · Product B','warranties','B','2019-12','warranty'],
].map(([cell,title,group,product,period,kind])=>({cell,title,group,product,period,kind,points:1}));
export const RUBRIC = [
 {id:'aggregation',title:'Monthly aggregation',points:2,method:'Sum revenue by product and year-month.',levels:['0: neither requested monthly total matches.','1: one requested monthly total matches.','2: both requested monthly totals match.']},
 {id:'pricing',title:'Selling price',points:2,method:'Divide monthly revenue by the same month’s units sold.',levels:['0: neither requested price matches.','1: one requested price matches.','2: both requested prices match.']},
 {id:'clearance',title:'Clearance identification',points:2,method:'Identify the recurring lower-price month for each product.',levels:['0: neither month matches.','1: one month matches.','2: both full month names match.']},
 {id:'returns',title:'Returns matched to sales',points:2,method:'Divide returns booked in t+1 by originating units in t.',levels:['0: neither requested rate matches.','1: one requested rate matches.','2: both requested rates match.']},
 {id:'warranties',title:'Warranties matched to sales',points:2,method:'Divide warranty claims booked in t+2 by originating units in t.',levels:['0: neither requested rate matches.','1: one requested rate matches.','2: both requested rates match.']},
];

export function shift(key,n){const [y,m]=key.split('-').map(Number),d=new Date(Date.UTC(y,m-1+n,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;}
export function feedbackEvidence(result,itemId,studentText=''){
 const r=result.results.find(x=>x.cell===itemId)??result.results.find(x=>x.status!=='correct')??result.results[0];
 // Names, IDs, timestamp, file name, raw workbook text, and full datasets never enter the model context.
 return {case:'Sports gear sales, returns and warranties; two products; 2011–2020',policy:'Returns for sales cohort t are booked in t+1. Warranty claims for sales cohort t are booked in t+2. Clearance sales cannot be returned but retain warranty coverage. Unobserved future claims are not zeros.',criterionId:r.group,criterion:RUBRIC.find(g=>g.id===r.group)?.method,answerCell:r.cell,product:r.product,salesPeriod:r.period,status:r.status,possibleMistakes:r.mistakes.map(m=>({id:m.id,title:m.title,explanation:m.description,hint:m.hint})),studentExplanation:studentText.slice(0,1200)};
}
