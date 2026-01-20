# Cost Savings Calculation - Aquametic System

## Overview
The system calculates **operational cost savings** by comparing **Traditional Scheduled Irrigation** vs **Smart Sensor-Based Irrigation**.

The key insight: **Smart irrigation reduces pump running time**, which directly saves:
- ⛽ **Fuel costs** (diesel/petrol)
- ⚡ **Electricity costs** (electric pumps)
- 👨‍🌾 **Labor costs** (reduced manual monitoring)
- 🔧 **Maintenance costs** (less equipment wear)

---

## Input Parameters

### 1. **Plot Size** (User Input)
- **Unit**: ACRES (converted to hectares internally)
- **Conversion**: 1 acre = 0.404686 hectares
- **Example**: 5 acres = 2.02 hectares

### 2. **Crop Type** (Affects Water Requirements)
The system uses different water rates per crop:

| Crop | Water Rate (L/hour/hectare) | Typical Use Case |
|------|----------------------------|------------------|
| **Rice** | 400,000 | Paddy fields (highest water need) |
| **Sugarcane** | 350,000 | High water requirement |
| **Corn** | 250,000 | Moderate-high |
| **Cotton** | 220,000 | Moderate |
| **Wheat** | 200,000 | Moderate |
| **Soybean** | 200,000 | Moderate |
| **Vegetable** | 180,000 | Lower water need |
| **Default** | 250,000 | Any unspecified crop |

### 3. **Pump Type & Energy Costs** (Configurable)
- **Diesel Pump**: RM 2.05/liter
- **Electric Pump**: RM 0.571/kWh
- **Pump Power Rating**: 3 kW (typical)
- **Labor Rate**: RM 15/hour
- **Diesel Consumption**: 0.3 L/kW/hour

---

## Traditional Irrigation Calculation

**Formula:**
```
Traditional Pump Hours = Frequency × Duration × Time_Period
Traditional Water = Pump Hours × Water_Rate × Plot_Size
```

**Default Parameters:**
- Frequency: **3 times per week**
- Duration: **2 hours per session**
- Water Rate: **Crop-specific** (see table above)
- Time Period: **30 days** (default analysis period)

**Example - 5 Acre Rice Field (30 days):**
```
Weeks = 30 / 7 = 4.29 weeks
Plot Size = 5 acres × 0.404686 = 2.02 hectares
Water Rate = 400,000 L/hour/hectare (rice)

Traditional Pump Hours = 3 × 2 × 4.29 = 25.7 hours
Traditional Water = 25.7 × 400,000 × 2.02 = 20.7 MILLION liters
```

**Interpretation:** 
Farmers irrigate on a fixed schedule (3x/week) regardless of actual soil moisture, leading to excessive pump operation.

---

## Smart Irrigation Calculation

The smart system uses **real-time soil moisture sensors** to irrigate only when needed:

**Logic:**
- Monitor soil moisture continuously
- Irrigate ONLY when moisture drops below **20%** (critical threshold)
- Target moisture: **40-70%** (optimal range)

**Formula:**
```
Smart Pump Hours = Irrigation_Events × Duration_Per_Event
Smart Water = Pump Hours × Water_Rate × Plot_Size
```

**Example - Same 5 Acre Rice Field:**
```
Irrigation Events = 5 (based on actual soil data over 30 days)
Duration Per Event = 1.5 hours (shorter, targeted sessions)

Smart Pump Hours = 5 × 1.5 = 7.5 hours
Smart Water = 7.5 × 400,000 × 2.02 = 6.06 MILLION liters
```

**Result:**
- Traditional: **25.7 pump hours**
- Smart: **7.5 pump hours**
- **Hours Saved: 18.2 hours (71% reduction)**

---

## Cost Savings Calculation

### For Diesel Pumps:

**Formula:**
```
Fuel Consumed = Pump Hours × Pump Power (kW) × Diesel Rate (L/kW/hour)
Fuel Cost = Fuel Consumed × Diesel Price
```

**Example:**
```
Pump Hours Saved = 18.2 hours
Pump Power = 3 kW
Diesel Consumption = 0.3 L/kW/hour
Diesel Price = RM 2.05/liter

Fuel Saved = 18.2 × 3 × 0.3 = 16.4 liters
Fuel Cost Saved = 16.4 × 2.05 = RM 33.62
```

### For Electric Pumps:

**Formula:**
```
Electricity Used = Pump Hours × Pump Power (kW)
Electricity Cost = Electricity Used × Rate (RM/kWh)
```

**Example:**
```
Pump Hours Saved = 18.2 hours
Pump Power = 3 kW
Electricity Rate = RM 0.571/kWh

Electricity Saved = 18.2 × 3 = 54.6 kWh
Electricity Cost Saved = 54.6 × 0.571 = RM 31.18
```

### Labor Cost Savings:

**Formula:**
```
Labor Cost = Pump Hours × Labor Rate
```

**Example:**
```
Pump Hours Saved = 18.2 hours
Labor Rate = RM 15/hour

Labor Cost Saved = 18.2 × 15 = RM 273.00
```

### Maintenance Cost Savings:

**Formula:**
```
Maintenance Savings = (Fuel Cost + Electricity Cost) × 10%
```

**Example:**
```
Energy Cost Saved = RM 33.62 (diesel example)
Maintenance Savings = 33.62 × 0.1 = RM 3.36
```

---

## Total Cost Savings

**For Diesel Pump Example:**
```
Fuel Cost Saved:        RM  33.62
Labor Cost Saved:       RM 273.00
Maintenance Saved:      RM   3.36
─────────────────────────────────
TOTAL SAVED:            RM 309.98
```

**Per Month (30 days):** RM 309.98  
**Per Year:** RM 3,719.76

---

## Environmental Impact (CO₂ Savings)

**Diesel CO₂ Formula:**
```
CO₂ Saved = Fuel Saved × 2.68 kg CO₂/liter
```

**Electric CO₂ Formula:**
```
CO₂ Saved = Electricity Saved × 0.694 kg CO₂/kWh
```

**Example (Diesel):**
```
Fuel Saved = 16.4 liters
CO₂ Saved = 16.4 × 2.68 = 43.95 kg CO₂
```

---

## Key Insights

### 💰 **Cost Priority Breakdown:**
1. **Labor Savings: ~88%** - Automation eliminates manual monitoring
2. **Energy Savings: ~11%** - Reduced fuel/electricity
3. **Maintenance Savings: ~1%** - Less equipment wear

### 📊 **Efficiency Gains:**
- **Traditional Method:** Fixed schedule, over-waters by 71%
- **Smart Method:** Data-driven, waters only when needed
- **Typical Savings:** 60-80% reduction in pump operating hours

### 🎯 **Why This Matters:**
The system doesn't save water from "free sources" - it saves money by:
- Running the pump **less** (not guessing soil moisture)
- Reducing **energy waste** (fuel/electricity)
- Eliminating **labor waste** (automated decisions)
- Extending **equipment life** (less wear and tear)

---

## Calculation Methodology

**The system calculates realistic cost savings by:**

1. **Tracking actual irrigation events** - Not every sensor reading triggers irrigation
2. **Using crop-specific water rates** - Different crops need different amounts
3. **Accounting for pump efficiency** - Real-world energy consumption
4. **Including all operational costs** - Fuel, electricity, labor, maintenance
5. **Providing configurable rates** - Farmers can input their actual costs

**Result:** Farmers see accurate, achievable cost savings that reflect real operational expenses.

---

## Configuration Options

Users can customize:
- Pump type (diesel/electric/both)
- Diesel price (RM/liter)
- Electricity rate (RM/kWh)
- Pump power rating (kW)
- Labor rate (RM/hour)
- Analysis period (7, 30, 90 days)

This ensures calculations match their actual operational costs.
