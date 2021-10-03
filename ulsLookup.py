#!/usr/bin/python3
import cgi, cgitb, os, re
import urllib.request
import json

ulsSearchUrlPrefix = "https://data.fcc.gov/api/license-view/basicSearch/getLicenses?sortColumn=expiredDate&format=json&searchValue="

data = []

def getULS(searchValue):
    with urllib.request.urlopen(ulsSearchUrlPrefix+searchValue) as url:
        ulsData = json.loads(url.read().decode())
    return ulsData

def licenseExists(data,licenseID):
    exists = False
    for license in data:
        if (license["licenseID"] == licenseID):
            exists = True
            break
    return exists

def addUniqueEntries(data,newData):
    for license in newData["Licenses"]["License"]:
        if (((license["serviceDesc"] == "Amateur") or (license["serviceDesc"] == "Vanity")) and (not licenseExists(data,license["licenseID"]))):
            data.append(license)

def addLicenses(data,searchValue):
    newData = getULS(searchValue)
    if (newData["status"] == "OK"):
        addUniqueEntries(data,newData)

referer = os.getenv("HTTP_REFERER", "")
result = re.search(r"^(https?:\/\/(?:.+\.)?malone\.org(?::\d{1,5})?)",referer)

if (result and (len(result.groups()) == 1)):
    corsValue = result.groups()[0]

    form = cgi.FieldStorage() 
    frn = form.getfirst('frn')
    callsign = form.getfirst('callsign')

    if (callsign and callsign.isalnum() and (len(callsign) <= 6)):
        addLicenses(data,callsign)

    if (frn and frn.isdecimal() and (len(frn) == 10)):
        addLicenses(data,frn)
else: 
    corsValue = None

# byCallsignData = getULS("0004610507")
# byCallsignData = json.loads('{"status":"OK","Licenses":{"page":"1","rowPerPage":"100","totalRows":"1","lastUpdate":"Aug 17, 2021","License":[{"licName":"MALONE JR, DANIEL J","frn":"0004610507","callsign":"AK6DM","categoryDesc":"Personal Use","serviceDesc":"Vanity","statusDesc":"Active","expiredDate":"11/06/2030","licenseID":"4351155","licDetailURL":"http://wireless2.fcc.gov/UlsApp/UlsSearch/license.jsp?__newWindow=false&licKey=4351155"}]}}')

# if (byCallsignData["status"] == "OK"):
#     addUniqueEntries(data,byCallsignData)

# byFrnData = getULS("0004610507")
# if (byFrnData["status"] == "OK"):
#     addUniqueEntries(data,byFrnData)



print("Content-type: application/json")
if (corsValue):
    print("Access-Control-Allow-Origin: " + corsValue)
print("")

print(json.JSONEncoder().encode(data))

