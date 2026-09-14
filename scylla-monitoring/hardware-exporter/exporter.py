import os
import glob
import time
import socket
import threading
import subprocess
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

SYS_PATH = os.getenv("SYS_PATH", "/sys")
PROC_PATH = os.getenv("PROC_PATH", "/proc")
GATEWAY_IP = os.getenv("GATEWAY_IP", "192.168.13.1")
HC_PING_URL = os.getenv("HC_PING_URL", "https://hc-ping.com/80eb57aa-0fb3-4f4e-aafb-252832041ccf")

PING_TARGETS = [
    ("gateway", GATEWAY_IP),
    ("google_dns", "8.8.8.8"),
    ("cloudflare_dns", "1.1.1.1")
]

# Cache for network metrics updated by background thread
network_metrics = {
    "internet_online": 1,
    "gateway_online": 1,
    "dns_online": 1,
    "dns_latency_ms": 0.0,
    "latencies": {},
    "wifi_quality": 0,
    "wifi_level_dbm": 0,
    "last_hc_ping_status": 200,
    "last_hc_ping_time": 0
}

def ping(host, timeout=1.0):
    try:
        t0 = time.perf_counter()
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        port = 53 if host in ["8.8.8.8", "1.1.1.1"] else 80
        s.connect((host, port))
        s.close()
        return (time.perf_counter() - t0) * 1000.0
    except Exception:
        try:
            t0 = time.perf_counter()
            ret = subprocess.run(["ping", "-c", "1", "-W", "1", host], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if ret.returncode == 0:
                return (time.perf_counter() - t0) * 1000.0
        except Exception:
            pass
        return None

def check_dns(host="google.com", timeout=1.0):
    try:
        t0 = time.perf_counter()
        socket.setdefaulttimeout(timeout)
        socket.gethostbyname(host)
        return (time.perf_counter() - t0) * 1000.0
    except Exception:
        return None

def get_current_telemetry_summary():
    # Read CPU package and NVMe for ping log payload
    cpu_temp = "N/A"
    nvme_temp = "N/A"
    try:
        for hw in glob.glob(os.path.join(SYS_PATH, "class", "hwmon", "hwmon*")):
            nf = os.path.join(hw, "name")
            if os.path.exists(nf):
                name = open(nf).read().strip()
                if name == "coretemp":
                    for tf in glob.glob(os.path.join(hw, "temp*_input")):
                        lf = tf.replace("_input", "_label")
                        if os.path.exists(lf) and "package" in open(lf).read().lower():
                            cpu_temp = f"{float(open(tf).read())/1000:.1f}°C"
                elif name == "nvme":
                    tf = os.path.join(hw, "temp1_input")
                    if os.path.exists(tf):
                        nvme_temp = f"{float(open(tf).read())/1000:.1f}°C"
    except Exception:
        pass
    return f"CPU: {cpu_temp} | NVMe: {nvme_temp} | GW Ping: {network_metrics['latencies'].get('gateway', 0):.1f}ms"

def heartbeat_worker():
    """Sends heartbeat ping to Healthchecks.io every 55 seconds"""
    while True:
        if HC_PING_URL:
            try:
                summary = get_current_telemetry_summary()
                payload = f"Hostname: kytran-ssh\nStatus: OK\nTelemetry: {summary}\nTimestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}".encode("utf-8")
                req = urllib.request.Request(
                    HC_PING_URL,
                    data=payload,
                    headers={"User-Agent": "kytran-ssh-watchdog/1.0"}
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    network_metrics["last_hc_ping_status"] = resp.status
                    network_metrics["last_hc_ping_time"] = time.time()
            except Exception as e:
                network_metrics["last_hc_ping_status"] = 0
        time.sleep(55)

def network_worker():
    while True:
        try:
            any_internet = False
            for label, target in PING_TARGETS:
                lat = ping(target)
                if lat is not None:
                    network_metrics["latencies"][label] = lat
                    if label in ["google_dns", "cloudflare_dns"]:
                        any_internet = True
                    if label == "gateway":
                        network_metrics["gateway_online"] = 1
                else:
                    network_metrics["latencies"][label] = -1.0
                    if label == "gateway":
                        network_metrics["gateway_online"] = 0
            
            network_metrics["internet_online"] = 1 if any_internet else 0
            
            dns_lat = check_dns()
            if dns_lat is not None:
                network_metrics["dns_online"] = 1
                network_metrics["dns_latency_ms"] = dns_lat
            else:
                network_metrics["dns_online"] = 0
                network_metrics["dns_latency_ms"] = -1.0

            wireless_f = os.path.join(PROC_PATH, "net", "wireless")
            if os.path.exists(wireless_f):
                try:
                    with open(wireless_f) as f:
                        lines = f.readlines()
                        for line in lines:
                            if ":" in line and not line.startswith("Inter-"):
                                parts = line.split()
                                if len(parts) >= 4:
                                    quality = float(parts[2].replace(".", ""))
                                    level = float(parts[3].replace(".", ""))
                                    network_metrics["wifi_quality"] = quality
                                    network_metrics["wifi_level_dbm"] = level
                except Exception:
                    pass
        except Exception:
            pass
        time.sleep(3)

def read_hwmon_temperatures():
    hwmon_map = {}
    base_hw = os.path.join(SYS_PATH, "class", "hwmon")
    for hw in sorted(glob.glob(os.path.join(base_hw, "hwmon*"))):
        name_file = os.path.join(hw, "name")
        if os.path.exists(name_file):
            name = open(name_file).read().strip()
            hwmon_map[name] = hw

    lines = []
    
    # 1. CPU Coretemp
    cpu_dir = hwmon_map.get("coretemp")
    if cpu_dir:
        lines.append("# HELP hardware_cpu_temperature_celsius CPU Core & Package temperatures")
        lines.append("# TYPE hardware_cpu_temperature_celsius gauge")
        for temp in sorted(glob.glob(os.path.join(cpu_dir, "temp*_input"))):
            label_f = temp.replace("_input", "_label")
            label = open(label_f).read().strip() if os.path.exists(label_f) else os.path.basename(temp)
            val = float(open(temp).read().strip()) / 1000.0
            crit_f = temp.replace("_input", "_crit")
            crit_val = float(open(crit_f).read().strip()) / 1000.0 if os.path.exists(crit_f) else 100.0
            
            clean_label = label.lower().replace(" ", "_")
            lines.append(f'hardware_cpu_temperature_celsius{{sensor="{clean_label}",label="{label}",crit="{crit_val}"}} {val:.1f}')

    # 2. NVMe SSD
    nvme_dir = hwmon_map.get("nvme")
    if nvme_dir:
        lines.append("# HELP hardware_nvme_temperature_celsius NVMe SSD composite temperature")
        lines.append("# TYPE hardware_nvme_temperature_celsius gauge")
        for temp in sorted(glob.glob(os.path.join(nvme_dir, "temp*_input"))):
            label_f = temp.replace("_input", "_label")
            label = open(label_f).read().strip() if os.path.exists(label_f) else "Composite"
            val = float(open(temp).read().strip()) / 1000.0
            max_f = temp.replace("_input", "_max")
            max_val = float(open(max_f).read().strip()) / 1000.0 if os.path.exists(max_f) else 84.8
            crit_f = temp.replace("_input", "_crit")
            crit_val = float(open(crit_f).read().strip()) / 1000.0 if os.path.exists(crit_f) else 89.8
            lines.append(f'hardware_nvme_temperature_celsius{{label="{label}",warn="{max_val}",crit="{crit_val}"}} {val:.1f}')

    # 3. Wi-Fi Card (iwlwifi)
    wifi_dir = hwmon_map.get("iwlwifi_1")
    if wifi_dir:
        temp_f = os.path.join(wifi_dir, "temp1_input")
        if os.path.exists(temp_f):
            val = float(open(temp_f).read().strip()) / 1000.0
            lines.append("# HELP hardware_wifi_temperature_celsius Intel Wi-Fi card temperature")
            lines.append("# TYPE hardware_wifi_temperature_celsius gauge")
            lines.append(f'hardware_wifi_temperature_celsius{{adapter="Intel AX201"}} {val:.1f}')

    # 4. Chipset PCH
    pch_dir = hwmon_map.get("pch_cometlake")
    if pch_dir:
        temp_f = os.path.join(pch_dir, "temp1_input")
        if os.path.exists(temp_f):
            val = float(open(temp_f).read().strip()) / 1000.0
            lines.append("# HELP hardware_pch_temperature_celsius Motherboard Chipset PCH temperature")
            lines.append("# TYPE hardware_pch_temperature_celsius gauge")
            lines.append(f'hardware_pch_temperature_celsius{{chipset="PCH Comet Lake"}} {val:.1f}')

    # 5. ACPI Thermal Zone
    acpi_dir = hwmon_map.get("acpitz")
    if acpi_dir:
        temp_f = os.path.join(acpi_dir, "temp1_input")
        if os.path.exists(temp_f):
            val = float(open(temp_f).read().strip()) / 1000.0
            lines.append("# HELP hardware_acpi_temperature_celsius ACPI thermal zone temperature")
            lines.append("# TYPE hardware_acpi_temperature_celsius gauge")
            lines.append(f'hardware_acpi_temperature_celsius {val:.1f}')

    # 6. Network Connectivity & Latency Metrics
    lines.append("# HELP server_internet_online Internet connectivity status (1=Online, 0=Offline)")
    lines.append("# TYPE server_internet_online gauge")
    lines.append(f'server_internet_online {network_metrics["internet_online"]}')

    lines.append("# HELP server_gateway_online Default Gateway connectivity (1=Reachable, 0=Unreachable)")
    lines.append("# TYPE server_gateway_online gauge")
    lines.append(f'server_gateway_online {network_metrics["gateway_online"]}')

    lines.append("# HELP server_dns_online DNS resolution status (1=OK, 0=Failed)")
    lines.append("# TYPE server_dns_online gauge")
    lines.append(f'server_dns_online {network_metrics["dns_online"]}')

    lines.append("# HELP server_ping_latency_ms Ping latency in milliseconds")
    lines.append("# TYPE server_ping_latency_ms gauge")
    for label, lat in network_metrics["latencies"].items():
        lines.append(f'server_ping_latency_ms{{target="{label}"}} {lat:.2f}')

    lines.append("# HELP server_dns_latency_ms DNS query resolution time in milliseconds")
    lines.append("# TYPE server_dns_latency_ms gauge")
    lines.append(f'server_dns_latency_ms {network_metrics["dns_latency_ms"]:.2f}')

    lines.append("# HELP server_heartbeat_cloud_ping_status Cloud heartbeat ping HTTP status (200=OK)")
    lines.append("# TYPE server_heartbeat_cloud_ping_status gauge")
    lines.append(f'server_heartbeat_cloud_ping_status {network_metrics["last_hc_ping_status"]}')

    if network_metrics["wifi_quality"] > 0:
        lines.append("# HELP server_wifi_link_quality Wi-Fi link quality score")
        lines.append("# TYPE server_wifi_link_quality gauge")
        lines.append(f'server_wifi_link_quality {network_metrics["wifi_quality"]}')

        lines.append("# HELP server_wifi_signal_dbm Wi-Fi signal level in dBm")
        lines.append("# TYPE server_wifi_signal_dbm gauge")
        lines.append(f'server_wifi_signal_dbm {network_metrics["wifi_level_dbm"]}')

    return "\n".join(lines) + "\n"

class MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/metrics":
            body = read_hwmon_temperatures().encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"healthy"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

def main():
    t_net = threading.Thread(target=network_worker, daemon=True)
    t_net.start()

    t_hb = threading.Thread(target=heartbeat_worker, daemon=True)
    t_hb.start()
    
    server = HTTPServer(("0.0.0.0", 9101), MetricsHandler)
    print("Host Hardware & Network Exporter with Cloud Heartbeat listening on port 9101...")
    server.serve_forever()

if __name__ == "__main__":
    main()
