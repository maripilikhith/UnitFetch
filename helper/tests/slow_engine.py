"""Controlled subprocess fixture for cancellation tests; never used by the application."""
import json
import time
print('UF_PROGRESS '+json.dumps({'status':'downloading','downloaded_bytes':100,'total_bytes':1000}),flush=True)
time.sleep(30)
