#!/usr/bin/python3
import cgi, cgitb, os, re, sys
import urllib.request
import json

debug = False
debugCLI = False

ulsSearchUrlPrefix = "https://data.fcc.gov/api/license-view/basicSearch/getLicenses?sortColumn=expiredDate&format=json&searchValue="

data = []

def getULS(searchValue):
    first = True
    pageNum = 1
    ulsData = {}
    tempData = {}

    try:
        while (first or (len(ulsData["Licenses"]["License"]) < int(ulsData["Licenses"]["totalRows"]))): 
            searchURL = ulsSearchUrlPrefix+searchValue+"&pageNum="+str(pageNum)
            with urllib.request.urlopen(searchURL) as url:
                tempData = json.loads(url.read().decode())
            if (first):
                ulsData = tempData
                first = False
            else:
                ulsData["Licenses"]["License"].extend(tempData["Licenses"]["License"])
            pageNum += 1
            if (pageNum > 8):
                break
    except Exception as e:
        if (debug):
            print(str(e))
            print(ulsData)
    
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

def filterEntries(data,callsign,frn):
    newData = []
    for license in data:
        if ((callsign and license["callsign"] == callsign) or (frn and license["frn"] == frn)):
            newData.append(license)
    return newData


if (debug): 
    print("Content-type: text/plain")
    print("")
    corsValue = None
 
referer = os.getenv("HTTP_REFERER", "")
result = re.search(r"^(https?:\/\/(?:.+\.)?malone\.org(?::\d{1,5})?)",referer)

if (debug or (result and (len(result.groups()) == 1))):
    if (result):
        corsValue = result.groups()[0]

    if (debugCLI):
        if (len(sys.argv) >= 2):
            callsign = sys.argv[1].upper()
        else:
            callsign = None

        if (len(sys.argv) >= 3):
            frn = sys.argv[2]
        else:
            frn = None
    else:
        form = cgi.FieldStorage() 
        frn = form.getfirst('frn')
        callsign = form.getfirst('callsign')

# /^[A-Z]{1,2}\d[A-Z]{1,3}$/   re.search(r"^[A-Z]{1,2}\d[A-Z]{1,3}$",callsign)
    if (callsign and re.search(r"^[A-Za-z]{1,2}\d[A-Za-z]{1,3}$",callsign)):
        addLicenses(data,callsign)

    if (frn and frn.isdecimal() and (len(frn) == 10)):
        addLicenses(data,frn)

    data = filterEntries(data,callsign,frn)

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

