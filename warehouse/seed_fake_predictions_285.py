import hashlib

raw = """
AAA.VN,AAM.VN,ABS.VN,ABT.VN,ACB.VN,ACC.VN,ACL.VN,ADG.VN,ADP.VN,ADS.VN,AGG.VN,AGR.VN,ANV.VN,APG.VN,APH.VN,ASM.VN,ASP.VN,AST.VN,BAF.VN,BCE.VN,BCM.VN,BFC.VN,BIC.VN,BID.VN,BKG.VN,BMC.VN,BMI.VN,BMP.VN,BRC.VN,BSI.VN,BTP.VN,BVH.VN,BWE.VN,C32.VN,CCL.VN,CDC.VN,CII.VN,CLC.VN,CLL.VN,CMG.VN,CMX.VN,CNG.VN,CRC.VN,CRE.VN,CSM.VN,CSV.VN,CTD.VN,CTF.VN,CTG.VN,CTI.VN,CTR.VN,CTS.VN,D2D.VN,DAH.VN,DBC.VN,DBD.VN,DBT.VN,DC4.VN,DCL.VN,DCM.VN,DGC.VN,DGW.VN,DHA.VN,DHC.VN,DHM.VN,DIG.VN,DMC.VN,DPG.VN,DPM.VN,DPR.VN,DRC.VN,DRL.VN,DSC.VN,DSE.VN,DSN.VN,DTA.VN,DVP.VN,DXG.VN,DXS.VN,EIB.VN,ELC.VN,EVE.VN,EVF.VN,FCM.VN,FCN.VN,FIR.VN,FIT.VN,FMC.VN,FPT.VN,FRT.VN,FTS.VN,GAS.VN,GDT.VN,GEE.VN,GEX.VN,GIL.VN
GMD.VN,GSP.VN,GVR.VN,HAG.VN,HAH.VN,HAP.VN,HAR.VN,HAX.VN,HCD.VN,HCM.VN,HDB.VN,HDC.VN,HDG.VN,HHP.VN,HHS.VN,HHV.VN,HID.VN,HII.VN,HMC.VN,HPG.VN,HPX.VN,HQC.VN,HSG.VN,HSL.VN,HT1.VN,HTG.VN,HTI.VN,HTN.VN,HUB.VN,HVH.VN,ICT.VN,IDI.VN,IJC.VN,ILB.VN,IMP.VN,ITC.VN,ITD.VN,JVC.VN,KBC.VN,KDC.VN,KDH.VN,KHG.VN,KHP.VN,KMR.VN,KOS.VN,KSB.VN,LAF.VN,LBM.VN,LCG.VN,LHG.VN,LIX.VN,LPB.VN,LSS.VN,MBB.VN,MCM.VN,MCP.VN,MHC.VN,MIG.VN,MSB.VN,MSH.VN,MSN.VN,MWG.VN,NAB.VN,NAF.VN,NBB.VN,NCT.VN,NHA.VN,NHH.VN,NKG.VN,NLG.VN,NNC.VN,NO1.VN,NSC.VN,NT2.VN,NTL.VN,OCB.VN,OGC.VN,ORS.VN,PAC.VN,PAN.VN,PC1.VN,PDR.VN,PET.VN,PGC.VN,PHC.VN,PHR.VN,PIT.VN,PLP.VN,PLX.VN,PNJ.VN,POW.VN,PPC.VN,PTB.VN,PTC.VN,PTL.VN
PVD.VN,PVP.VN,PVT.VN,QCG.VN,RAL.VN,REE.VN,RYG.VN,SAB.VN,SAM.VN,SAV.VN,SBG.VN,SBT.VN,SCR.VN,SCS.VN,SFC.VN,SFG.VN,SGN.VN,SGR.VN,SGT.VN,SHB.VN,SHI.VN,SIP.VN,SJD.VN,SJS.VN,SKG.VN,SMB.VN,SSB.VN,SSI.VN,ST8.VN,STB.VN,STK.VN,SVT.VN,SZC.VN,SZL.VN,TCB.VN,TCH.VN,TCI.VN,TCL.VN,TCM.VN,TCO.VN,TCT.VN,TDC.VN,TDG.VN,TDP.VN,TEG.VN,THG.VN,TIP.VN,TLD.VN,TLG.VN,TLH.VN,TMT.VN,TNH.VN,TNI.VN,TNT.VN,TPB.VN,TRC.VN,TSC.VN,TTA.VN,TTF.VN,TV2.VN,TVS.VN,TYA.VN,UIC.VN,VCA.VN,VCB.VN,VCG.VN,VCI.VN,VDS.VN,VFG.VN,VGC.VN,VHC.VN,VHM.VN,VIB.VN,VIC.VN,VIP.VN,VIX.VN,VJC.VN,VMD.VN,VND.VN,VNL.VN,VNM.VN,VNS.VN,VOS.VN,VPB.VN,VPG.VN,VPH.VN,VPI.VN,VRC.VN,VRE.VN,VSC.VN,VTO.VN,VTP.VN,YBM.VN,YEG.VN
"""
codes = []
for part in raw.replace("\n", ",").split(","):
    p = part.strip().upper()
    if not p:
        continue
    if p.endswith(".VN"):
        p = p.removesuffix(".VN")
    codes.append(p)
seen = set()
uniq = []
for c in codes:
    if c not in seen:
        seen.add(c)
        uniq.append(c)


def fake_price(code: str) -> int:
    h = int(hashlib.md5(code.encode()).hexdigest()[:8], 16)
    return 3000 + (h % 197000)


def fake_conf(code: str) -> float:
    h = int(hashlib.md5((code + "c").encode()).hexdigest()[:8], 16)
    return round(0.55 + (h % 4000) / 10000.0, 4)


out = ["/tmp/seed_pred_285.sql"]
with open(out[0], "w") as f:
    f.write("BEGIN;\n")
    for c in uniq:
        esc = c.replace("'", "''")
        f.write(
            f"INSERT INTO dim_stock (stock_code, exchange, quote_type) VALUES ('{esc}', 'HOSE', 1) "
            f"ON CONFLICT (stock_code) DO NOTHING;\n"
        )
    f.write(
        "INSERT INTO fact_predictions (stock_code, prediction_date, predicted_price, model_version, confidence_score)\nVALUES\n"
    )
    rows = []
    for c in uniq:
        esc = c.replace("'", "''")
        rows.append(
            f"  ('{esc}', CURRENT_DATE, {fake_price(c)}, 'fake-seed-285', {fake_conf(c)})"
        )
    f.write(",\n".join(rows))
    f.write(
        "\nON CONFLICT (stock_code, prediction_date) DO UPDATE SET\n"
        "  predicted_price = EXCLUDED.predicted_price,\n"
        "  model_version = EXCLUDED.model_version,\n"
        "  confidence_score = EXCLUDED.confidence_score;\n"
    )
    f.write("COMMIT;\n")

assert len(uniq) == 285, len(uniq)
