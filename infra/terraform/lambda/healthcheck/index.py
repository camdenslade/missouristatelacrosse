import json
import urllib.request
import boto3

URL = "https://api.missouristatelacrosse.com/actuator/health"
cloudwatch = boto3.client("cloudwatch")

def handler(event, context):
    up = 0
    try:
        req = urllib.request.Request(URL, headers={"X-Program": "men"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            body = json.loads(resp.read().decode())
            if resp.status == 200 and body.get("status") == "UP":
                up = 1
    except Exception:
        up = 0

    cloudwatch.put_metric_data(
        Namespace="MostateLacrosse",
        MetricData=[{"MetricName": "BackendUp", "Value": up, "Unit": "None"}]
    )
    return {"up": up}
