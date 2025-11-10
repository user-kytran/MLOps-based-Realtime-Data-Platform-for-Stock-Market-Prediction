export const ALL_STOCK_SYMBOLS = new Set<string>([
  "AAA","AAM","ABS","ABT","ACB","ACC","ACL","ADG","ADP","ADS",
  "AGG","AGR","ANV","APG","APH","ASM","ASP","AST","BAF","BCE",
  "BCM","BFC","BIC","BID","BKG","BMC","BMI","BMP","BRC","BSI",
  "BTP","BVH","BWE","C32","CCL","CDC","CII","CLC","CLL","CMG",
  "CMX","CNG","CRC","CRE","CSM","CSV","CTD","CTF","CTG","CTI",
  "CTR","CTS","D2D","DAH","DBC","DBD","DBT","DC4","DCL","DCM",
  "DGC","DGW","DHA","DHC","DHM","DIG","DMC","DPG","DPM","DPR",
  "DRC","DRL","DSC","DSE","DSN","DTA","DVP","DXG","DXS","EIB",
  "ELC","EVE","EVF","FCM","FCN","FIR","FIT","FMC","FPT","FRT",
  "FTS","GAS","GDT","GEE","GEX","GIL","GMD","GSP","GVR","HAG",
  "HAH","HAP","HAR","HAX","HCD","HCM","HDB","HDC","HDG","HHP",
  "HHS","HHV","HID","HII","HMC","HPG","HPX","HQC","HSG","HSL",
  "HT1","HTG","HTI","HTN","HUB","HVH","ICT","IDI","IJC","ILB",
  "IMP","ITC","ITD","JVC","KBC","KDC","KDH","KHG","KHP","KMR",
  "KOS","KSB","LAF","LBM","LCG","LHG","LIX","LPB","LSS","MBB",
  "MCM","MCP","MHC","MIG","MSB","MSH","MSN","MWG","NAB","NAF",
  "NBB","NCT","NHA","NHH","NKG","NLG","NNC","NO1","NSC","NT2",
  "NTL","OCB","OGC","ORS","PAC","PAN","PC1","PDR","PET","PGC",
  "PHC","PHR","PIT","PLP","PLX","PNJ","POW","PPC","PTB","PTC",
  "PTL","PVD","PVP","PVT","QCG","RAL","REE","RYG","SAB","SAM",
  "SAV","SBG","SBT","SCR","SCS","SFC","SFG","SGN","SGR","SGT",
  "SHB","SHI","SIP","SJD","SJS","SKG","SMB","SSB","SSI","ST8",
  "STB","STK","SVT","SZC","SZL","TCB","TCH","TCI","TCL","TCM",
  "TCO","TCT","TDC","TDG","TDP","TEG","THG","TIP","TLD","TLG",
  "TLH","TMT","TNH","TNI","TNT","TPB","TRC","TSC","TTA","TTF",
  "TV2","TVS","TYA","UIC","VCA","VCB","VCG","VCI","VDS","VFG",
  "VGC","VHC","VHM","VIB","VIC","VIP","VIX","VJC","VMD","VND",
  "VNL","VNM","VNS","VOS","VPB","VPG","VPH","VPI","VRC","VRE",
  "VSC","VTO","VTP","YBM","YEG"
]);

export function isValidStockSymbol(symbol: string): boolean {
  return ALL_STOCK_SYMBOLS.has(symbol.toUpperCase());
}

