import json
import urllib.request
import boto3

API_URL = "https://api.missouristatelacrosse.com/actuator/health"
SITE_URL = "https://missouristatelacrosse.com/"
cloudwatch = boto3.client("cloudwatch")


def api_up():
    try:
        req = urllib.request.Request(API_URL, headers={"X-Program": "men"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            body = json.loads(resp.read().decode())
            return 1 if resp.status == 200 and body.get("status") == "UP" else 0
    except Exception:
        return 0


def site_up():
    try:
        req = urllib.request.Request(SITE_URL)
        with urllib.request.urlopen(req, timeout=8) as resp:
            return 1 if resp.status == 200 else 0
    except Exception:
        return 0


def handler(event, context):
    backend = api_up()
    site = site_up()

    cloudwatch.put_metric_data(
        Namespace="MostateLacrosse",
        MetricData=[
            {"MetricName": "BackendUp", "Value": backend, "Unit": "None"},
            {"MetricName": "SiteUp", "Value": site, "Unit": "None"},
        ],
    )
    return {"backend_up": backend, "site_up": site}
