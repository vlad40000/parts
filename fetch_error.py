import urllib.request
import urllib.error

req = urllib.request.Request('https://parts-hazel.vercel.app/api/extract/cold-sync', data=b'{}', method='POST')
req.add_header('Content-Type', 'application/json')
try:
    res = urllib.request.urlopen(req)
    print(res.read().decode())
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode())

