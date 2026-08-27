import os
import re
import dotenv

dotenv.load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

# ScyllaDB 
SCYLLA_PORT = int(os.getenv("SCYLLA_PORT", "9042"))
SCYLLA_KEYSPACE = os.getenv("SCYLLA_KEYSPACE", "stock_data")
SCYLLA_DC = os.getenv("SCYLLA_DC", "datacenter1")

if os.getenv("AIRFLOW_HOME"):
    SCYLLA_HOSTS = [
        os.getenv("SCYLLA_NODE1", "scylla-node1"),
        os.getenv("SCYLLA_NODE2", "scylla-node2"),
        os.getenv("SCYLLA_NODE3", "scylla-node3"),
    ]
else:
    SCYLLA_HOSTS = ["localhost"]

# LLM
# GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
# GEMINI_TEMPERATURE = float(os.getenv("GEMINI_TEMPERATURE", "0.3"))
GEMINI_BASE_URL = os.getenv(
    "GEMINI_BASE_URL",
    "http://g4f-sentiment-api:8080/v1" if os.getenv("AIRFLOW_HOME") else "http://localhost:1337/v1",
)

# DataLab 
DATALAB_CONVERT_URL = "https://www.datalab.to/api/v1/convert"
DATALAB_MAX_FILE_BYTES = 200 * 1024 * 1024
DATALAB_MODE = os.getenv("DATALAB_MODE", "balanced")
DATALAB_POLL_INTERVAL_SECONDS = float(os.getenv("DATALAB_POLL_INTERVAL_SECONDS", "2"))
DATALAB_POLL_TIMEOUT_SECONDS = int(os.getenv("DATALAB_POLL_TIMEOUT_SECONDS", "900"))
DATALAB_MAX_CONCURRENT_PER_KEY = int(os.getenv("DATALAB_MAX_CONCURRENT_PER_KEY", "2"))
DATALAB_KEY_WAIT_TIMEOUT_SECONDS = int(os.getenv("DATALAB_KEY_WAIT_TIMEOUT_SECONDS", "120"))
LLM_MARKDOWN_MAX_CHARS = int(os.getenv("LLM_MARKDOWN_MAX_CHARS", "12000"))

def load_datalab_api_keys() -> list[str]:
    pattern = re.compile(r"^API_KEY_DATALAB(\d+)$", re.IGNORECASE)
    indexed_keys = []
    for name, value in os.environ.items():
        match = pattern.match(name)
        if match and value.strip():
            indexed_keys.append((int(match.group(1)), value.strip()))
    return [value for _, value in sorted(indexed_keys)]

# Threading
MAX_WORKERS = int(os.getenv("NEWS_MAX_WORKERS", "50"))
CRAWLER_MAX_WORKERS = int(os.getenv("CRAWLER_MAX_WORKERS", "10"))

# Code
DEFAULT_STOCK_CODES = [
    "AAA", "AAM", "ABS", "ABT", "ACB", "ACC", "ACL", "ADG", "ADP", "ADS", "AGG", "AGR", "ANV", "APG", "APH",
    "ASM", "ASP", "AST", "BAF", "BCE", "BCM", "BFC", "BIC", "BID", "BKG", "BMC", "BMI", "BMP", "BRC", "BSI",
    "BTP", "BVH", "BWE", "C32", "CCL", "CDC", "CII", "CLC", "CLL", "CMG", "CMX", "CNG", "CRC", "CRE", "CSM",
    "CSV", "CTD", "CTF", "CTG", "CTI", "CTR", "CTS", "D2D", "DAH", "DBC", "DBD", "DBT", "DC4", "DCL", "DCM",
    "DGC", "DGW", "DHA", "DHC", "DHM", "DIG", "DMC", "DPG", "DPM", "DPR", "DRC", "DRL", "DSC", "DSE", "DSN",
    "DTA", "DVP", "DXG", "DXS", "EIB", "ELC", "EVE", "EVF", "FCM", "FCN", "FIR", "FIT", "FMC", "FPT", "FRT",
    "FTS", "GAS", "GDT", "GEE", "GEX", "GIL", "GMD", "GSP", "GVR", "HAG", "HAH", "HAP", "HAR", "HAX", "HCD",
    "HCM", "HDB", "HDC", "HDG", "HHP", "HHS", "HHV", "HID", "HII", "HMC", "HPG", "HPX", "HQC", "HSG", "HSL",
    "HT1", "HTG", "HTI", "HTN", "HUB", "HVH", "ICT", "IDI", "IJC", "ILB", "IMP", "ITC", "ITD", "JVC", "KBC",
    "KDC", "KDH", "KHG", "KHP", "KMR", "KOS", "KSB", "LAF", "LBM", "LCG", "LHG", "LIX", "LPB", "LSS", "MBB",
    "MCM", "MCP", "MHC", "MIG", "MSB", "MSH", "MSN", "MWG", "NAB", "NAF", "NBB", "NCT", "NHA", "NHH", "NKG",
    "NLG", "NNC", "NO1", "NSC", "NT2", "NTL", "OCB", "OGC", "ORS", "PAC", "PAN", "PC1", "PDR", "PET", "PGC",
    "PHC", "PHR", "PIT", "PLP", "PLX", "PNJ", "POW", "PPC", "PTB", "PTC", "PTL", "PVD", "PVP", "PVT", "QCG",
    "RAL", "REE", "RYG", "SAB", "SAM", "SAV", "SBG", "SBT", "SCR", "SCS", "SFC", "SFG", "SGN", "SGR", "SGT",
    "SHB", "SHI", "SIP", "SJD", "SJS", "SKG", "SMB", "SSB", "SSI", "ST8", "STB", "STK", "SVT", "SZC", "SZL",
    "TCB", "TCH", "TCI", "TCL", "TCM", "TCO", "TCT", "TDC", "TDG", "TDP", "TEG", "THG", "TIP", "TLD", "TLG",
    "TLH", "TMT", "TNH", "TNI", "TNT", "TPB", "TRC", "TSC", "TTA", "TTF", "TV2", "TVS", "TYA", "UIC", "VCA",
    "VCB", "VCG", "VCI", "VDS", "VFG", "VGC", "VHC", "VHM", "VIB", "VIC", "VIP", "VIX", "VJC", "VMD", "VND",
    "VNL", "VNM", "VNS", "VOS", "VPB", "VPG", "VPH", "VPI", "VRC", "VRE", "VSC", "VTO", "VTP", "YBM", "YEG"
]
