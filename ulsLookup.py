#!/usr/bin/python3
import cgi, cgitb, os, re, sys
import urllib.request
import json
import sqlite3
import time

debug = False
debugCLI = False

ulsSearchUrlPrefix = "https://data.fcc.gov/api/license-view/basicSearch/getLicenses?sortColumn=expiredDate&format=json&searchValue="

licenses = []
resultPayload = {}

### TEST AND PROD SHARE A CACHE
cacheDbPath = "../../data/ulsCache.db"
cacheDbTableName = "ulsSearchResults"
cacheDbTableDefinition = "{}(KEY TEXT NOT NULL PRIMARY KEY, TIMESTAMP INTEGER, JSON TEXT)".format(cacheDbTableName)
cacheDb = None

refreshCacheTime = 86400  # 86400 = 1 day in seconds
maxCacheTime = 604800     # 604800 = 1 week in seconds
maxCacheSize = 1000       # max 1000 entries

# openCache
def openCache():
    global cacheDb
    # connect to database with autocommit
    cacheDb = sqlite3.connect(cacheDbPath, isolation_level=None)

    # see if our table exists
    cur = cacheDb.cursor()
    result = cur.execute("SELECT tbl_name FROM sqlite_master WHERE type='table' AND tbl_name=?;", [cacheDbTableName]).fetchall()
    if (len(result) == 0):
        cur.execute("CREATE TABLE {};".format(cacheDbTableDefinition))
        # print('table created')
    else:
        pass
        clearExpiredCache()   # Not the greatest to do this every time

# getCache
def getCache(key):
    global cacheDb
    selectString = "SELECT * FROM {} WHERE KEY=?;".format(cacheDbTableName)
    cur = cacheDb.cursor()
    queryResult = cur.execute(selectString, [key]).fetchall()
    if (len(queryResult) == 1):
        result = json.loads(queryResult[0][2])
    else:
        result = None
    return result

# cacheExists
def cacheExists(key):
    global cacheDb
    if (getCache(key) is None):
        result = False
    else:
        result = True
    return result

# updateCache
def updateCache(key,obj):
    global cacheDb
    now = int(time.time())
    jsonStr = json.dumps(obj)

    cur = cacheDb.cursor()
    if (cacheExists(key)):
        updateString = "UPDATE {} SET TIMESTAMP=?,JSON=? WHERE KEY=?;".format(cacheDbTableName)
        result = cur.execute(updateString,[now,jsonStr,key])
    else:
        insertString = "INSERT INTO {}(KEY,TIMESTAMP,JSON) VALUES (?,?,?);".format(cacheDbTableName)
        result = cur.execute(insertString,[key,now,jsonStr])

def cacheNeedsRefresh(key):
    global cacheDb
    now = int(time.time())
    minTime = now - refreshCacheTime
    selectString = "SELECT COUNT(*) FROM {} WHERE KEY=? AND TIMESTAMP>?;".format(cacheDbTableName)
    cur = cacheDb.cursor()
    queryResult = cur.execute(selectString, [key,minTime]).fetchall()
    if (queryResult[0][0] == 1):
        result = False
    else:
        result = True
    return result

# clearExpiredCache
def clearExpiredCache():
    global cacheDb
    now = int(time.time())
    deleteBeforeTime = now - maxCacheTime

    selectString = "SELECT COUNT(*),MIN(TIMESTAMP) FROM {};".format(cacheDbTableName)
    cur = cacheDb.cursor()
    queryResult = cur.execute(selectString).fetchall()

    cacheSize,minTime = queryResult[0]
    if (minTime is None):
        minTime = now

    if ((cacheSize > maxCacheSize) or (minTime < deleteBeforeTime)):
        deleteString = "DELETE FROM {} WHERE KEY NOT IN (SELECT KEY FROM {} WHERE TIMESTAMP > {} ORDER BY TIMESTAMP DESC LIMIT {});".format(cacheDbTableName,cacheDbTableName,deleteBeforeTime,maxCacheSize)
        deleteResult = cur.execute(deleteString)

    # compact the database
    cacheDb.execute("VACUUM")

def dumpCache():
    global cacheDb
    selectString = "SELECT * FROM {} ORDER BY TIMESTAMP DESC;".format(cacheDbTableName)
    cur = cacheDb.cursor()
    queryResult = cur.execute(selectString).fetchall()

    for row in queryResult:
        print(row)

def queryULS(searchValue):
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

def getULS(searchValue):
    result = None
    tryAgain = False

    if (cacheNeedsRefresh(searchValue)):
        if debug:
            print("cache refresh")
        ulsResult = queryULS(searchValue)
        if ("status" in ulsResult):
            if debug:
                print("good status, update cache")
            updateCache(searchValue,ulsResult)
            result = ulsResult
        else:
            tryAgain = True
            if (not cacheExists(searchValue)):
                if debug:
                    print("error but no cache")
                result = ulsResult
        
    if (result is None):
        if debug:
            print("no result yet, get cache")
        result = getCache(searchValue)

    return result, tryAgain

def licenseExists(licenses,licenseID):
    exists = False
    for license in licenses:
        if (("licenseID" in license) and (license["licenseID"] == licenseID)):
            exists = True
            break
    return exists

def addUniqueEntries(licenses,ulsData):
    for license in ulsData["Licenses"]["License"]:
        if (((license["serviceDesc"] == "Amateur") or (license["serviceDesc"] == "Vanity")) and (not licenseExists(licenses,license["licenseID"]))):
            licenses.append(license)

def addError(licenses,ulsData):
    licenses.append(ulsData)

def addLicenses(licenses,searchValue):
    ulsData, tryAgain = getULS(searchValue)
    # ignoring errors for now, but here's where to deal with them if needed
    if ("status" in ulsData):
        if (ulsData["status"] == "OK"):
            addUniqueEntries(licenses,ulsData)
    else:
        addError(licenses,ulsData)
    
    return tryAgain

def filterEntries(licenses,callsign,frn):
    newLicenses = []
    for license in licenses:
        if (("Errors" in license) or (callsign and ("callsign" in license) and license["callsign"] == callsign) or (frn and ("frn" in license) and license["frn"] == frn)):
            newLicenses.append(license)
    return newLicenses


if (debug): 
    print("Content-type: text/plain")
    print("")
    corsValue = None

openCache()
 
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

    tryAgainCallsign = False
    tryAgainFRN = False

# /^[A-Z]{1,2}\d[A-Z]{1,3}$/   re.search(r"^[A-Z]{1,2}\d[A-Z]{1,3}$",callsign)
    if (callsign and re.search(r"^[A-Za-z]{1,2}\d[A-Za-z]{1,3}$",callsign)):
        tryAgainCallsign = addLicenses(licenses,callsign)

    if (frn and frn.isdecimal() and (len(frn) == 10)):
        tryAgainFRN = addLicenses(licenses,frn)

    licenses = filterEntries(licenses,callsign,frn)

    resultPayload["tryAgain"] = (tryAgainFRN or tryAgainCallsign)
    resultPayload["licenses"] = licenses

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

print(json.JSONEncoder().encode(resultPayload))

