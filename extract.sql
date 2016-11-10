SELECT clients.clid, clients.cm, clients.first, clients.middle, clients.last, clients.dob, clients.otn, clients.so, cms.first AS cm_first, cms.last AS cm_last, cms.email AS cm_email
FROM clients
LEFT JOIN cms ON (clients.cm = cms.cmid)
ORDER BY clients.clid;