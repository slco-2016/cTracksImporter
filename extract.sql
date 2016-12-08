-- this should correspond with https://github.com/slco-2016/clientcomm/wiki/County-specific-developments

SELECT  clients.clid, 
        clients.cm, 
        clients.first,
        coalesce(clients.middle, '') AS middle,
        clients.last,
        clients.dob,
        coalesce(clients.otn, '') AS otn, 
        coalesce(clients.so, '') AS so, 
        cms.first AS cm_first, 
        cms.last AS cm_last, 
        cms.email AS cm_email 
FROM clients
LEFT JOIN cms ON (cms.cmid = clients.cm)
WHERE clients.active IS TRUE
AND cms.department IN (2, 3, 5, 6, 7, 9, 11)
ORDER BY clients.clid;