import type { FuelType, Vehicle } from "../types";

export interface MotorisationOption {
  label: string;
  fuelType: FuelType;
}

const petrol = (label: string): MotorisationOption => ({ label, fuelType: "Petrol" });
const diesel = (label: string): MotorisationOption => ({ label, fuelType: "Diesel" });
const hybrid = (label: string): MotorisationOption => ({ label, fuelType: "Hybrid" });
const electric = (label: string): MotorisationOption => ({ label, fuelType: "Electric" });

// Offline suggestions, not a VIN-verified specification database. The form always
// offers a custom value because engines can vary by year, country and trim.
const CATALOG: Record<string, Record<string, MotorisationOption[]>> = {
  "Alfa Romeo": {
    Giulia: [petrol("2.0 Turbo"), diesel("2.2 JTDm"), petrol("2.9 V6 Quadrifoglio")],
    Stelvio: [petrol("2.0 Turbo"), diesel("2.2 JTDm"), petrol("2.9 V6 Quadrifoglio")],
    Tonale: [hybrid("1.5 Hybrid"), hybrid("1.3 Plug-in Hybrid"), diesel("1.6 Diesel")],
  },
  Audi: {
    A1: [petrol("25 TFSI"), petrol("30 TFSI"), petrol("35 TFSI")],
    A3: [petrol("30 TFSI"), petrol("35 TFSI"), diesel("30 TDI"), diesel("35 TDI"), hybrid("40 TFSI e")],
    A4: [petrol("35 TFSI"), petrol("40 TFSI"), diesel("35 TDI"), diesel("40 TDI")],
    A5: [petrol("40 TFSI"), petrol("45 TFSI"), diesel("40 TDI"), diesel("45 TDI")],
    A6: [petrol("40 TFSI"), diesel("40 TDI"), diesel("50 TDI"), hybrid("50 TFSI e")],
    Q3: [petrol("35 TFSI"), petrol("40 TFSI"), diesel("35 TDI"), hybrid("45 TFSI e")],
    Q5: [petrol("40 TFSI"), diesel("40 TDI"), hybrid("50 TFSI e")],
    Q7: [diesel("45 TDI"), diesel("50 TDI"), hybrid("55 TFSI e")],
    "Q4 e-tron": [electric("35 e-tron"), electric("40 e-tron"), electric("50 e-tron quattro")],
    "e-tron GT": [electric("e-tron GT quattro"), electric("RS e-tron GT")],
  },
  BMW: {
    "1 Series": [petrol("118i"), petrol("120i"), diesel("118d"), diesel("120d"), petrol("M135i xDrive")],
    "2 Series": [petrol("218i"), petrol("220i"), diesel("220d"), petrol("M240i xDrive")],
    "3 Series": [petrol("318i"), petrol("320i"), petrol("330i"), diesel("320d"), diesel("330d"), hybrid("330e Plug-in Hybrid")],
    "4 Series": [petrol("420i"), petrol("430i"), diesel("420d"), petrol("M440i xDrive")],
    "5 Series": [petrol("520i"), diesel("520d"), hybrid("530e Plug-in Hybrid"), petrol("540i")],
    X1: [petrol("sDrive18i"), diesel("sDrive18d"), hybrid("xDrive25e Plug-in Hybrid"), electric("iX1 xDrive30")],
    X3: [petrol("xDrive20i"), diesel("xDrive20d"), hybrid("xDrive30e Plug-in Hybrid"), electric("iX3")],
    X5: [diesel("xDrive30d"), petrol("xDrive40i"), hybrid("xDrive45e Plug-in Hybrid")],
    i4: [electric("eDrive35"), electric("eDrive40"), electric("M50 xDrive")],
    iX: [electric("xDrive40"), electric("xDrive50"), electric("M60")],
  },
  Chevrolet: {
    Bolt: [electric("Bolt EV"), electric("Bolt EUV")],
    Camaro: [petrol("2.0 Turbo"), petrol("3.6 V6"), petrol("6.2 V8 SS")],
    Equinox: [petrol("1.5 Turbo"), petrol("2.0 Turbo"), electric("Equinox EV")],
    Silverado: [petrol("2.7 TurboMax"), petrol("5.3 V8"), diesel("3.0 Duramax")],
  },
  Citroen: {
    C3: [petrol("1.2 PureTech"), diesel("1.5 BlueHDi"), electric("e-C3")],
    C4: [petrol("1.2 PureTech"), diesel("1.5 BlueHDi"), electric("e-C4")],
    "C5 Aircross": [petrol("1.2 PureTech"), diesel("1.5 BlueHDi"), hybrid("1.6 Plug-in Hybrid")],
  },
  Dacia: {
    Sandero: [petrol("1.0 TCe 90"), petrol("1.0 ECO-G 100")],
    Duster: [petrol("1.3 TCe 150"), diesel("1.5 Blue dCi"), hybrid("1.6 Hybrid 140")],
    Jogger: [petrol("1.0 TCe 110"), petrol("1.0 ECO-G 100"), hybrid("1.6 Hybrid 140")],
  },
  Fiat: {
    "500": [petrol("1.2 Fire"), hybrid("1.0 Mild Hybrid"), electric("500e Electric")],
    Panda: [petrol("1.2 Fire"), hybrid("1.0 Mild Hybrid")],
    Tipo: [petrol("1.0 FireFly"), diesel("1.6 MultiJet"), hybrid("1.5 Hybrid")],
  },
  Ford: {
    Fiesta: [petrol("1.0 EcoBoost"), hybrid("1.0 EcoBoost mHEV"), diesel("1.5 TDCi"), petrol("1.5 EcoBoost ST")],
    Focus: [petrol("1.0 EcoBoost"), petrol("1.5 EcoBoost"), diesel("1.5 EcoBlue"), petrol("2.3 EcoBoost ST")],
    Puma: [petrol("1.0 EcoBoost"), hybrid("1.0 EcoBoost Mild Hybrid"), petrol("1.5 EcoBoost ST")],
    Kuga: [petrol("1.5 EcoBoost"), diesel("2.0 EcoBlue"), hybrid("2.5 Full Hybrid"), hybrid("2.5 Plug-in Hybrid")],
    "Mustang Mach-E": [electric("Standard Range RWD"), electric("Extended Range AWD"), electric("GT AWD")],
  },
  Honda: {
    Civic: [petrol("1.0 VTEC Turbo"), petrol("1.5 VTEC Turbo"), hybrid("2.0 e:HEV"), petrol("2.0 VTEC Turbo Type R")],
    "Civic Type R": [petrol("2.0 VTEC Turbo")],
    "CR-V": [petrol("1.5 VTEC Turbo"), hybrid("2.0 e:HEV"), hybrid("2.0 e:PHEV")],
    "HR-V": [petrol("1.5 i-VTEC"), hybrid("1.5 e:HEV")],
    Jazz: [petrol("1.3 i-VTEC"), hybrid("1.5 e:HEV")],
  },
  Hyundai: {
    i10: [petrol("1.0 MPi"), petrol("1.2 MPi"), petrol("1.0 T-GDi")],
    i20: [petrol("1.2 MPi"), petrol("1.0 T-GDi"), petrol("1.6 T-GDi N")],
    i30: [petrol("1.0 T-GDi"), petrol("1.5 T-GDi"), diesel("1.6 CRDi"), petrol("2.0 T-GDi N")],
    Kona: [petrol("1.0 T-GDi"), hybrid("1.6 Hybrid"), electric("Kona Electric 48 kWh"), electric("Kona Electric 65 kWh")],
    Tucson: [petrol("1.6 T-GDi"), diesel("1.6 CRDi"), hybrid("1.6 Hybrid"), hybrid("1.6 Plug-in Hybrid")],
    "Ioniq 5": [electric("Standard Range RWD"), electric("Long Range RWD"), electric("Long Range AWD"), electric("Ioniq 5 N")],
    "Ioniq 6": [electric("Standard Range RWD"), electric("Long Range RWD"), electric("Long Range AWD")],
  },
  Jeep: {
    Renegade: [petrol("1.0 T3"), diesel("1.6 MultiJet"), hybrid("1.5 e-Hybrid"), hybrid("1.3 4xe Plug-in Hybrid")],
    Compass: [petrol("1.3 T4"), diesel("1.6 MultiJet"), hybrid("1.5 e-Hybrid"), hybrid("1.3 4xe Plug-in Hybrid")],
    Wrangler: [petrol("2.0 Turbo"), petrol("3.6 V6"), hybrid("2.0 4xe Plug-in Hybrid")],
  },
  Kia: {
    Picanto: [petrol("1.0 MPi"), petrol("1.2 MPi"), petrol("1.0 T-GDi")],
    Ceed: [petrol("1.0 T-GDi"), petrol("1.5 T-GDi"), diesel("1.6 CRDi"), hybrid("1.6 Plug-in Hybrid")],
    Sportage: [petrol("1.6 T-GDi"), diesel("1.6 CRDi"), hybrid("1.6 Hybrid"), hybrid("1.6 Plug-in Hybrid")],
    Niro: [hybrid("1.6 Hybrid"), hybrid("1.6 Plug-in Hybrid"), electric("Niro EV 64.8 kWh")],
    EV6: [electric("Standard Range RWD"), electric("Long Range RWD"), electric("Long Range AWD"), electric("GT AWD")],
    EV9: [electric("Standard Range RWD"), electric("Long Range AWD"), electric("GT-Line AWD")],
  },
  "Land Rover": {
    Defender: [diesel("D200"), diesel("D300"), petrol("P300"), hybrid("P400e Plug-in Hybrid")],
    "Discovery Sport": [diesel("D165"), diesel("D200"), petrol("P200"), hybrid("P300e Plug-in Hybrid")],
    "Range Rover Evoque": [diesel("D165"), petrol("P200"), hybrid("P300e Plug-in Hybrid")],
    "Range Rover Sport": [diesel("D300"), petrol("P400"), hybrid("P460e Plug-in Hybrid")],
  },
  Lexus: {
    UX: [hybrid("UX 250h"), hybrid("UX 300h"), electric("UX 300e")],
    NX: [hybrid("NX 350h"), hybrid("NX 450h+ Plug-in Hybrid")],
    RX: [hybrid("RX 350h"), hybrid("RX 450h+ Plug-in Hybrid"), hybrid("RX 500h")],
    IS: [petrol("IS 300"), hybrid("IS 300h"), petrol("IS 350 V6")],
  },
  Mazda: {
    Mazda2: [petrol("1.5 Skyactiv-G"), hybrid("1.5 Hybrid")],
    Mazda3: [petrol("2.0 Skyactiv-G"), petrol("2.0 Skyactiv-X"), diesel("1.8 Skyactiv-D")],
    "CX-30": [petrol("2.0 Skyactiv-G"), petrol("2.0 Skyactiv-X"), diesel("1.8 Skyactiv-D")],
    "CX-5": [petrol("2.0 Skyactiv-G"), petrol("2.5 Skyactiv-G"), diesel("2.2 Skyactiv-D")],
    "MX-5": [petrol("1.5 Skyactiv-G"), petrol("2.0 Skyactiv-G")],
  },
  "Mercedes-Benz": {
    "A-Class": [petrol("A 180"), petrol("A 200"), diesel("A 180 d"), hybrid("A 250 e Plug-in Hybrid")],
    "C-Class": [petrol("C 180"), petrol("C 200"), diesel("C 220 d"), hybrid("C 300 e Plug-in Hybrid")],
    "E-Class": [petrol("E 200"), diesel("E 220 d"), hybrid("E 300 e Plug-in Hybrid"), hybrid("E 300 de Plug-in Hybrid")],
    GLA: [petrol("GLA 200"), diesel("GLA 200 d"), hybrid("GLA 250 e Plug-in Hybrid")],
    GLC: [petrol("GLC 200"), diesel("GLC 220 d"), hybrid("GLC 300 e Plug-in Hybrid")],
    EQA: [electric("EQA 250"), electric("EQA 300 4MATIC"), electric("EQA 350 4MATIC")],
    EQB: [electric("EQB 250"), electric("EQB 300 4MATIC"), electric("EQB 350 4MATIC")],
    EQE: [electric("EQE 300"), electric("EQE 350+"), electric("EQE 500 4MATIC")],
  },
  MG: {
    MG4: [electric("Standard Range"), electric("Long Range"), electric("Extended Range"), electric("XPower AWD")],
    ZS: [petrol("1.5 VTi-Tech"), petrol("1.0 T-GDi"), electric("ZS EV Standard Range"), electric("ZS EV Long Range")],
    HS: [petrol("1.5 T-GDi"), hybrid("1.5 Plug-in Hybrid")],
  },
  MINI: {
    Cooper: [petrol("Cooper 1.5"), petrol("Cooper S 2.0"), electric("Cooper E"), electric("Cooper SE")],
    Countryman: [petrol("Cooper C"), petrol("Cooper S ALL4"), diesel("Cooper D"), electric("Countryman SE ALL4")],
  },
  Nissan: {
    Micra: [petrol("1.0 IG-T"), petrol("0.9 IG-T"), diesel("1.5 dCi")],
    Leaf: [electric("Leaf 40 kWh"), electric("Leaf e+ 62 kWh")],
    Juke: [petrol("1.0 DIG-T"), hybrid("1.6 Hybrid")],
    Qashqai: [petrol("1.3 DIG-T"), hybrid("1.3 Mild Hybrid"), hybrid("1.5 e-POWER"), diesel("1.5 dCi")],
    "X-Trail": [petrol("1.3 DIG-T"), hybrid("1.5 e-POWER"), hybrid("1.5 e-4ORCE")],
    Ariya: [electric("63 kWh 2WD"), electric("87 kWh 2WD"), electric("87 kWh e-4ORCE")],
  },
  Opel: {
    Corsa: [petrol("1.2 Turbo"), diesel("1.5 Diesel"), electric("Corsa Electric")],
    Astra: [petrol("1.2 Turbo"), diesel("1.5 Diesel"), hybrid("1.6 Plug-in Hybrid"), electric("Astra Electric")],
    Mokka: [petrol("1.2 Turbo"), diesel("1.5 Diesel"), electric("Mokka Electric")],
    Grandland: [petrol("1.2 Turbo"), diesel("1.5 Diesel"), hybrid("1.6 Plug-in Hybrid")],
    Insignia: [petrol("1.5 Turbo"), petrol("2.0 Turbo"), diesel("1.6 CDTi"), diesel("2.0 CDTi")],
  },
  Peugeot: {
    "208": [petrol("1.2 PureTech"), diesel("1.5 BlueHDi"), electric("e-208")],
    "308": [petrol("1.2 PureTech"), diesel("1.5 BlueHDi"), hybrid("1.6 Plug-in Hybrid"), electric("e-308")],
    "2008": [petrol("1.2 PureTech"), diesel("1.5 BlueHDi"), electric("e-2008")],
    "3008": [petrol("1.2 PureTech"), diesel("1.5 BlueHDi"), hybrid("1.6 Plug-in Hybrid"), electric("E-3008")],
    "508": [petrol("1.6 PureTech"), diesel("1.5 BlueHDi"), hybrid("1.6 Plug-in Hybrid")],
  },
  Porsche: {
    "911": [petrol("Carrera 3.0"), petrol("Carrera S 3.0"), petrol("Turbo 3.8")],
    Macan: [petrol("2.0 Turbo"), petrol("Macan S 2.9 V6"), electric("Macan Electric")],
    Cayenne: [petrol("3.0 V6"), hybrid("E-Hybrid 3.0 V6"), petrol("Cayenne S 4.0 V8")],
    Taycan: [electric("Taycan RWD"), electric("Taycan 4S"), electric("Taycan Turbo")],
  },
  Renault: {
    Clio: [petrol("1.0 TCe"), diesel("1.5 Blue dCi"), hybrid("1.6 E-Tech Hybrid")],
    Megane: [petrol("1.3 TCe"), diesel("1.5 Blue dCi"), hybrid("1.6 E-Tech Plug-in Hybrid"), electric("Megane E-Tech Electric")],
    Captur: [petrol("1.0 TCe"), petrol("1.3 TCe"), hybrid("1.6 E-Tech Hybrid"), hybrid("1.6 E-Tech Plug-in Hybrid")],
    Austral: [petrol("1.2 Mild Hybrid"), hybrid("1.2 E-Tech Hybrid")],
    Zoe: [electric("R110 52 kWh"), electric("R135 52 kWh")],
  },
  SEAT: {
    Ibiza: [petrol("1.0 TSI"), petrol("1.5 TSI"), diesel("1.6 TDI")],
    Leon: [petrol("1.0 TSI"), petrol("1.5 TSI"), diesel("2.0 TDI"), hybrid("1.4 e-Hybrid")],
    Arona: [petrol("1.0 TSI"), petrol("1.5 TSI"), diesel("1.6 TDI")],
    Ateca: [petrol("1.5 TSI"), petrol("2.0 TSI"), diesel("2.0 TDI")],
  },
  Skoda: {
    Fabia: [petrol("1.0 MPI"), petrol("1.0 TSI"), petrol("1.5 TSI")],
    Octavia: [petrol("1.0 TSI"), petrol("1.5 TSI"), diesel("2.0 TDI"), hybrid("1.4 iV Plug-in Hybrid")],
    Superb: [petrol("1.5 TSI"), petrol("2.0 TSI"), diesel("2.0 TDI"), hybrid("1.4 iV Plug-in Hybrid")],
    Karoq: [petrol("1.0 TSI"), petrol("1.5 TSI"), diesel("2.0 TDI")],
    Kodiaq: [petrol("1.5 TSI"), petrol("2.0 TSI"), diesel("2.0 TDI"), hybrid("1.5 iV Plug-in Hybrid")],
    Enyaq: [electric("Enyaq 60"), electric("Enyaq 80"), electric("Enyaq 85"), electric("Enyaq RS")],
  },
  Subaru: {
    Impreza: [petrol("2.0 Boxer"), hybrid("2.0 e-Boxer")],
    Outback: [petrol("2.5 Boxer"), petrol("2.4 Turbo Boxer"), diesel("2.0 Boxer Diesel")],
    Forester: [petrol("2.5 Boxer"), hybrid("2.0 e-Boxer")],
    BRZ: [petrol("2.0 Boxer"), petrol("2.4 Boxer")],
  },
  Suzuki: {
    Swift: [petrol("1.2 Dualjet"), hybrid("1.2 Mild Hybrid"), petrol("1.4 Boosterjet Sport")],
    Vitara: [petrol("1.4 Boosterjet"), hybrid("1.4 Mild Hybrid"), hybrid("1.5 Full Hybrid")],
    Jimny: [petrol("1.5 VVT")],
    "S-Cross": [petrol("1.4 Boosterjet"), hybrid("1.4 Mild Hybrid"), hybrid("1.5 Full Hybrid")],
  },
  Tesla: {
    "Model 3": [electric("Rear-Wheel Drive"), electric("Long Range AWD"), electric("Performance AWD")],
    "Model Y": [electric("Rear-Wheel Drive"), electric("Long Range AWD"), electric("Performance AWD")],
    "Model S": [electric("Dual Motor AWD"), electric("Plaid Tri Motor")],
    "Model X": [electric("Dual Motor AWD"), electric("Plaid Tri Motor")],
  },
  Toyota: {
    Aygo: [petrol("1.0 VVT-i"), petrol("1.0 VVT-i X")],
    Yaris: [petrol("1.0 VVT-i"), petrol("1.5 Dynamic Force"), hybrid("1.5 Hybrid")],
    Corolla: [petrol("1.2 Turbo"), hybrid("1.8 Hybrid"), hybrid("2.0 Hybrid")],
    "C-HR": [hybrid("1.8 Hybrid"), hybrid("2.0 Hybrid"), hybrid("2.0 Plug-in Hybrid")],
    RAV4: [petrol("2.0 Valvematic"), hybrid("2.5 Hybrid"), hybrid("2.5 Plug-in Hybrid")],
    Prius: [hybrid("1.8 Hybrid"), hybrid("2.0 Hybrid"), hybrid("2.0 Plug-in Hybrid")],
    bZ4X: [electric("FWD 71.4 kWh"), electric("AWD 71.4 kWh")],
  },
  Vauxhall: {
    Corsa: [petrol("1.2 Turbo"), diesel("1.5 Diesel"), electric("Corsa Electric")],
    Astra: [petrol("1.2 Turbo"), diesel("1.5 Diesel"), hybrid("1.6 Plug-in Hybrid"), electric("Astra Electric")],
    Mokka: [petrol("1.2 Turbo"), diesel("1.5 Diesel"), electric("Mokka Electric")],
    Grandland: [petrol("1.2 Turbo"), diesel("1.5 Diesel"), hybrid("1.6 Plug-in Hybrid")],
  },
  Volkswagen: {
    Polo: [petrol("1.0 MPI"), petrol("1.0 TSI"), diesel("1.6 TDI"), petrol("2.0 TSI GTI")],
    Golf: [petrol("1.0 TSI"), petrol("1.5 TSI"), diesel("2.0 TDI"), petrol("2.0 TSI GTI"), hybrid("1.4 GTE Plug-in Hybrid")],
    Passat: [petrol("1.5 TSI"), petrol("2.0 TSI"), diesel("2.0 TDI"), hybrid("1.4 GTE Plug-in Hybrid")],
    Tiguan: [petrol("1.5 TSI"), petrol("2.0 TSI"), diesel("2.0 TDI"), hybrid("1.4 eHybrid")],
    "T-Roc": [petrol("1.0 TSI"), petrol("1.5 TSI"), diesel("2.0 TDI"), petrol("2.0 TSI R")],
    "ID.3": [electric("Pure 45 kWh"), electric("Pro 58 kWh"), electric("Pro S 77 kWh")],
    "ID.4": [electric("Pure 52 kWh"), electric("Pro 77 kWh"), electric("GTX AWD")],
    Transporter: [diesel("2.0 TDI"), diesel("2.0 BiTDI"), electric("e-Transporter")],
  },
  Volvo: {
    XC40: [hybrid("B3 Mild Hybrid"), hybrid("B4 Mild Hybrid"), hybrid("T5 Recharge Plug-in Hybrid"), electric("Recharge Pure Electric")],
    XC60: [diesel("B4 Diesel"), petrol("B5 Petrol"), hybrid("T6 Recharge Plug-in Hybrid"), hybrid("T8 Recharge Plug-in Hybrid")],
    XC90: [diesel("B5 Diesel"), petrol("B6 Petrol"), hybrid("T8 Recharge Plug-in Hybrid")],
    V60: [diesel("B4 Diesel"), petrol("B5 Petrol"), hybrid("T6 Recharge Plug-in Hybrid")],
    EX30: [electric("Single Motor"), electric("Single Motor Extended Range"), electric("Twin Motor Performance")],
    EX90: [electric("Twin Motor"), electric("Twin Motor Performance")],
  },
};

function key(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const makeAliases: Record<string, string> = {
  vw: "Volkswagen",
  mercedes: "Mercedes-Benz",
  chevy: "Chevrolet",
};

function makeKey(make: string): string {
  const normalized = key(make);
  return key(makeAliases[normalized] ?? make);
}

function matchingMake(make: string): string | undefined {
  return Object.keys(CATALOG).find((entry) => key(entry) === makeKey(make));
}

function uniqueNames(names: string[]): string[] {
  const unique = new Map<string, string>();
  names.forEach((name) => {
    const normalized = key(name);
    if (normalized && !unique.has(normalized)) unique.set(normalized, name);
  });
  return [...unique.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Catalog entries plus the current user's own makes, including custom ones. */
export function getMakes(vehicles: Vehicle[]): string[] {
  return uniqueNames([...Object.keys(CATALOG), ...vehicles.map((v) => v.make)]);
}

export function getModels(make: string, vehicles: Vehicle[]): string[] {
  const catalogMake = matchingMake(make);
  const catalogModels = catalogMake ? Object.keys(CATALOG[catalogMake]) : [];
  const savedModels = vehicles
    .filter((v) => makeKey(v.make) === makeKey(make))
    .map((v) => v.model);
  return uniqueNames([...catalogModels, ...savedModels]);
}

export function getMotorisations(
  make: string,
  model: string,
  vehicles: Vehicle[],
): MotorisationOption[] {
  const catalogMake = matchingMake(make);
  const catalogModel = catalogMake
    ? Object.keys(CATALOG[catalogMake]).find((entry) => key(entry) === key(model))
    : undefined;
  const suggestions = catalogMake && catalogModel
    ? [...CATALOG[catalogMake][catalogModel]]
    : [];
  const known = new Set(suggestions.map((option) => key(option.label)));

  vehicles
    .filter((v) => makeKey(v.make) === makeKey(make) && key(v.model) === key(model))
    .forEach((v) => {
      if (!v.motorisation?.trim() || known.has(key(v.motorisation))) return;
      suggestions.push({ label: v.motorisation.trim(), fuelType: v.fuelType });
      known.add(key(v.motorisation));
    });

  return suggestions;
}