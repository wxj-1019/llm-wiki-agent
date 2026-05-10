#!/usr/bin/env python3
from tools.fetchers._common import RetryStateManager, ContentFingerprint, DomainHealthTracker

r = RetryStateManager()
c = ContentFingerprint()
d = DomainHealthTracker()
print("RetryStateManager OK")
print("ContentFingerprint OK")
print("DomainHealthTracker OK")
print("All imports OK")
