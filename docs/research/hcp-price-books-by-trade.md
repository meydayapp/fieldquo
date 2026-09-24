# Housecall Pro — seeded price books by industry (raw capture)

Captured 2026-09-21/22 from a 14-day trial (pro.housecallpro.com, company signed up as **Electrical**, USD, US account), by reading the
app's own price-book API from inside the logged-in session (`/alpha/pricebook/industries`, `/alpha/pricebook/categories`,
`/alpha/pricebook/services`, `/api/pricebook/services/{uuid}/recommendations`). Every industry in the price book's
"+ Industry" picker was added to the trial's price book (adding an industry **merges** — it never wipes the existing books —
there is no warning dialog at all) and its complete seeded service list was read back. Nothing was edited or deleted.

**How to read the columns**

- **Task code** — HCP's stable key per seeded service (`DEFAULT_<INDUSTRY>_SERVICE_<n>`). Rows without one are (a) the four generic
  "Custom Services" HCP created for the **signup** industry only (Electrical: Standard Install, Diagnostic Visit, Service Visit,
  Preventative Maintenance — industries added later do not get them) and (b) six older code-less books that ship a "Custom Job"
  placeholder plus a short symptom list (Water Heater, Tile & Grout, Carpet Repair, Furniture & Upholstery, Rug Cleaning, Well Pumps).
- Three industries seed **nothing at all** (Detailing, Generator, Construction & Remodeling — the card is created with zero categories),
  and 44 of the 99 are a single "<Industry> - Book an appointment" placeholder at $100.00 — mostly the non-field-service industries.
- **Base** — the seeded price (the API stores cents; shown here in dollars as the UI shows it). Two generations of content coexist:
  the **new "HCP pricing content" books** (Electrical, Plumbing, HVAC, Handyman, General Contractor, Painting, Carpet/Home Cleaning,
  Garage, Landscaping, Appliances, Automotive, Pest, Air Duct, Window Cleaning … — long marketing descriptions, `DEFAULT_<X>_SERVICE_0…n`)
  ship every service at **$0.00**; the **older template books** ("Installation - X / Repair - X" naming, one-line descriptions such as
  "Expert snow removal service") ship a round placeholder price per industry ($100 / $200 / $600 / $1,200) that is plainly not a real
  rate. In total 927 of the 1,666 captured services carry such a placeholder; 739 are $0.00. HCP therefore ships names + descriptions,
  never a usable price — the price comes from the Pricing Insights median.
- **P25 / Median / P75** — the "Pricing Insights" panel on the service page. HCP labels them **Min / Median / Max**, but the API field
  names are `quartile_25`, `median`, `quartile_75` — they are quartiles, not extremes. Cluster shown = `NATIONAL`, currency = `USD`
  (no CAD cluster exists; the "Like me" tab returned "Similar pricing data is currently unavailable." for this trial). Blank = HCP has
  no insight for that service (the API returned an empty array).
- **Unit** — seeded unit of measure; HCP's only units are `Sq. Ft.` and `Each`; blank = none set.
- **Dur** — default duration in minutes when seeded (only the "Book Now" online-booking services carry one).
- **OB** — `online_booking_enabled` at seed time.
- Descriptions are verbatim; line breaks inside a description are shown as ` / `.


## Summary — every industry in the picker

| # | Industry | Services | Seeded | Categories | With insight | Median of medians |
|---|---|---|---|---|---|---|
| 1 | Heating & Air Conditioning | 103 | 103 | 13 | 103 | $389 |
| 2 | Carpet Cleaning | 50 | 50 | 4 | 6 | $98 |
| 3 | Home Cleaning | 39 | 39 | 6 | 7 | $150 |
| 4 | Plumbing | 90 | 90 | 11 | 90 | $325 |
| 5 | Electrical | 73 | 69 | 14 | 62 | $390 |
| 6 | Garage | 18 | 18 | 4 | 6 | $127 |
| 7 | Handyman | 81 | 81 | 10 | 12 | $177 |
| 8 | Window & Exterior Cleaning | 17 | 17 | 4 | 7 | $189 |
| 9 | Landscaping & Lawn | 20 | 20 | 4 | 0 |  |
| 10 | Appliances | 21 | 21 | 4 | 0 |  |
| 11 | Automotive | 19 | 19 | 4 | 0 |  |
| 12 | General Contractor | 108 | 108 | 14 | 7 | $700 |
| 13 | Air Duct Cleaning | 19 | 19 | 4 | 0 |  |
| 14 | Pest Control | 22 | 22 | 4 | 0 |  |
| 15 | Painting | 41 | 41 | 6 | 23 | $1,541 |
| 16 | Accountant | 1 | 1 | 1 | 0 |  |
| 17 | Alternative Therapy | 1 | 1 | 1 | 0 |  |
| 18 | Appraisal | 1 | 1 | 1 | 0 |  |
| 19 | Audio & TV | 22 | 22 | 6 | 0 |  |
| 20 | Baby Proof | 1 | 1 | 1 | 0 |  |
| 21 | Barber | 1 | 1 | 1 | 0 |  |
| 22 | Business Services | 1 | 1 | 1 | 0 |  |
| 23 | Cabinetry | 7 | 7 | 2 | 4 | $202 |
| 24 | Carpet Repair | 2 | 0 | 2 | 0 |  |
| 25 | Concrete & Asphalt | 51 | 51 | 17 | 0 |  |
| 26 | Cooking | 1 | 1 | 1 | 0 |  |
| 27 | Credit Counselor | 1 | 1 | 1 | 0 |  |
| 28 | Deck & Patio | 25 | 25 | 8 | 0 |  |
| 29 | Demolition | 7 | 7 | 2 | 0 |  |
| 30 | Document Storage & Destruction | 1 | 1 | 1 | 0 |  |
| 31 | Doors | 15 | 15 | 6 | 2 | $125 |
| 32 | Drywall | 8 | 8 | 2 | 1 | $650 |
| 33 | Fencing | 62 | 62 | 8 | 1 | $338 |
| 34 | Financial Planner | 1 | 1 | 1 | 0 |  |
| 35 | Fireplace & Chimney | 80 | 80 | 16 | 0 |  |
| 36 | Fitness | 1 | 1 | 1 | 0 |  |
| 37 | Fleets & Trucks | 1 | 1 | 1 | 0 |  |
| 38 | Flooring | 70 | 70 | 12 | 0 |  |
| 39 | Furniture & Upholstery | 1 | 0 | 1 | 0 |  |
| 40 | Glass | 1 | 1 | 1 | 0 |  |
| 41 | Graphics & Printing | 1 | 1 | 1 | 0 |  |
| 42 | Gutters | 33 | 33 | 8 | 0 |  |
| 43 | Health & Beauty | 1 | 1 | 1 | 0 |  |
| 44 | Home Inspection | 16 | 16 | 2 | 0 |  |
| 45 | Install & Assemble | 1 | 1 | 1 | 0 |  |
| 46 | Insurance | 1 | 1 | 1 | 0 |  |
| 47 | Interior & Surface Cleaning | 1 | 1 | 1 | 0 |  |
| 48 | Janitorial | 24 | 24 | 6 | 15 | $140 |
| 49 | Junk Removal | 18 | 18 | 8 | 5 | $230 |
| 50 | Laundry | 1 | 1 | 1 | 0 |  |
| 51 | Lawyer | 1 | 1 | 1 | 0 |  |
| 52 | Lender | 1 | 1 | 1 | 0 |  |
| 53 | Lighting | 36 | 36 | 8 | 11 | $193 |
| 54 | Locksmith | 20 | 20 | 8 | 0 |  |
| 55 | Marine Services | 1 | 1 | 1 | 0 |  |
| 56 | Massage | 1 | 1 | 1 | 0 |  |
| 57 | Medical | 1 | 1 | 1 | 0 |  |
| 58 | Mortgage Broker | 1 | 1 | 1 | 0 |  |
| 59 | Moving | 22 | 22 | 4 | 0 |  |
| 60 | Music & Singing | 1 | 1 | 1 | 0 |  |
| 61 | Natural Stone | 1 | 1 | 1 | 0 |  |
| 62 | Neighborhood Chores | 1 | 1 | 1 | 0 |  |
| 63 | Notary | 1 | 1 | 1 | 0 |  |
| 64 | Organization & Interior Design | 1 | 1 | 1 | 0 |  |
| 65 | Parties | 1 | 1 | 1 | 0 |  |
| 66 | Pets | 1 | 1 | 1 | 0 |  |
| 67 | Photography | 1 | 1 | 1 | 0 |  |
| 68 | Pool & Spa | 35 | 35 | 10 | 0 |  |
| 69 | Property Manager | 1 | 1 | 1 | 0 |  |
| 70 | Real Estate | 1 | 1 | 1 | 0 |  |
| 71 | Restoration | 52 | 52 | 12 | 0 |  |
| 72 | Regulatory & Environmental | 1 | 1 | 1 | 0 |  |
| 73 | Roof & Attic | 59 | 59 | 10 | 0 |  |
| 74 | Rug Cleaning | 1 | 0 | 1 | 0 |  |
| 75 | Security | 58 | 58 | 10 | 7 | $157 |
| 76 | Sewer & Septic | 24 | 24 | 10 | 0 |  |
| 77 | Siding | 18 | 18 | 3 | 0 |  |
| 78 | Smart Home | 34 | 34 | 6 | 0 |  |
| 79 | Snow Removal | 6 | 6 | 2 | 0 |  |
| 80 | Solar & Energy | 10 | 10 | 6 | 0 |  |
| 81 | Tax Planner | 1 | 1 | 1 | 0 |  |
| 82 | Tech Help | 1 | 1 | 1 | 0 |  |
| 83 | Transportation | 1 | 1 | 1 | 0 |  |
| 84 | Device Repair | 1 | 1 | 1 | 0 |  |
| 85 | Tile & Grout | 2 | 0 | 2 | 0 |  |
| 86 | Tree Services | 14 | 14 | 7 | 0 |  |
| 87 | Tutoring | 1 | 1 | 1 | 0 |  |
| 88 | Water Heater | 10 | 0 | 2 | 0 |  |
| 89 | Water Transfer Printing | 1 | 1 | 1 | 0 |  |
| 90 | Water Treatment | 29 | 29 | 8 | 0 |  |
| 91 | Well Pumps | 1 | 0 | 1 | 0 |  |
| 92 | Wildlife Control | 1 | 1 | 1 | 0 |  |
| 93 | Windows | 8 | 8 | 8 | 0 |  |
| 94 | Wine | 1 | 1 | 1 | 0 |  |
| 95 | Detailing | 0 | 0 | 0 | 0 |  |
| 96 | Generator | 0 | 0 | 0 | 0 |  |
| 97 | Construction & Remodeling | 0 | 0 | 0 | 0 |  |
| 98 | Caulking & Sealants | 1 | 1 | 1 | 0 |  |
| 99 | Insulation | 20 | 20 | 10 | 0 |  |

**Total services captured: 1666**

## Heating & Air Conditioning

- Services: **103** (103 with a task code, 0 without) in **13** categories (` > ` = nested subcategory): Blower Motors, Book Now, Coils, Compressors, Condensate Drain, Condenser, Fan Belts, Filters, General Maintenance & Controls, Heat Exchangers, Refrigerant, Repair Services, System Installation
- Pricing insight available for 103 of 103 services; median of medians **$389**
- Industry card image seeded: yes (stock photo)

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Blower Motors | Replace Blower Motor | DEFAULT_HVAC_SERVICE_0 |  | $0.00 | $350 | $639 | $1,000 |  |  | Restore your HVAC system's functionality with our blower motor replacement service. If the motor is beyond repair, our technicians can replace it with a new one. Our technicians will ensure the new motor is installed correctly, restoring proper airflow and system performance. With our blower motor replacement service, you can enjoy a more efficient HVAC system and a more comfortable home. |
| Blower Motors | Replace Blower Motor Module | DEFAULT_HVAC_SERVICE_1 |  | $0.00 | $425 | $800 | $1,344 |  |  | Ensure proper airflow control in your HVAC system with our blower motor module replacement service. Our technicians will remove the old module that controls the fan speed and install a new one. With our blower motor module replacement service, you can restore proper airflow control, ensuring your home stays comfortable and energy efficient. |
| Blower Motors | Replace Blower Wheel | DEFAULT_HVAC_SERVICE_2 |  | $0.00 | $323 | $428 | $600 |  |  | Improve airflow and system performance in your HVAC system with our blower wheel replacement service. Our technicians will remove the old blower wheel, which helps circulate air, and install a new one. With our blower wheel replacement service, you can ensure proper airflow and system performance, keeping your home comfortable year-round. |
| Blower Motors | Clean Blower Motor | DEFAULT_HVAC_SERVICE_3 |  | $0.00 | $340 | $415 | $499 |  |  | Keep your HVAC system running smoothly with our blower motor cleaning service. Our technicians will carefully clean the blower motor and its components, removing dirt, debris, and dust that can affect its performance. With our blower motor cleaning service, you can improve airflow and energy efficiency in your HVAC system, ensuring your home stays comfortable year-round. |
| Blower Motors | Replace Or Install Hvac Evaporator Motor | DEFAULT_HVAC_SERVICE_4 |  | $0.00 | $400 | $755 | $1,357 |  |  | Replace or install evaporator motor to improve system efficiency and airflow. |
| Book Now | Air Quality Improvement | DEFAULT_HVAC_SERVICE_5 |  | $0.00 | $108 | $155 | $619 | 120 | yes | Experiencing any of these air quality issues? / Dust / Allergens / Humidity / Ventilation / Filter Issues / Our expert technicians can help you breathe easier by addressing these common problems. Improve your home's air quality for a healthier and more comfortable living environment. / Book our Air Quality Improvement service today and enjoy cleaner, fresher air in your home! |
| Book Now | Duct Cleaning | DEFAULT_HVAC_SERVICE_6 |  | $0.00 | $625 | $920 | $1,495 | 120 | yes | If you haven't had your ducts cleaned recently, it's time to book with us! Our expert technicians will remove dust, allergens, and contaminants from your air ducts, improving your home's air quality and HVAC efficiency. |
| Book Now | Heating Repair | DEFAULT_HVAC_SERVICE_7 |  | $0.00 | $89 | $105 | $138 | 120 | yes | Is your home experiencing any of these heating issues? / No heat / Inconsistent temperatures / Strange noises from the heater / Unexpectedly high energy bills / If your heating system isn’t working properly, book with us today! Our skilled technicians will diagnose and fix the problem quickly, ensuring your home stays warm and comfortable. |
| Book Now | Cooling Repair | DEFAULT_HVAC_SERVICE_8 |  | $0.00 | $85 | $95 | $125 | 120 | yes | Is your home experiencing any of these cooling issues? / No cooling / Inconsistent temperatures / Strange noises from the AC / Unexpectedly high energy bills / If your cooling system isn’t working properly, book with us today! Our skilled technicians will diagnose and fix the problem quickly, ensuring your home stays cool and comfortable. |
| Book Now | Thermostat | DEFAULT_HVAC_SERVICE_9 |  | $0.00 | $99 | $139 | $225 | 120 | yes | Is your thermostat causing any of these issues? / Inaccurate temperature readings / Failure to maintain set temperatures / Display not functioning / No response to adjustments / If your thermostat isn’t working correctly, book with us today! Our expert technicians will diagnose and repair the issue or install a new thermostat, ensuring precise temperature control in your home. |
| Coils | Inspect Coils | DEFAULT_HVAC_SERVICE_10 |  | $0.00 | $80 | $125 | $185 |  |  | Ensure your HVAC system is in top condition with our thorough coil inspection service. Our technicians will inspect your coils for any signs of damage, corrosion, or leaks that could lead to issues with your system. With our detailed inspection, you can catch potential problems early and avoid costly repairs down the road. Trust us to keep your HVAC system running smoothly with our expert coil inspection service. |
| Coils | Clean Coils | DEFAULT_HVAC_SERVICE_11 |  | $0.00 | $250 | $425 | $650 |  |  | Keep your HVAC system running smoothly with our coil cleaning service. Over time, dirt, dust, and debris can build up on your evaporator and condenser coils, reducing efficiency. Our technicians will carefully clean these coils, ensuring optimal performance and energy efficiency for your system. Breathe easier and enjoy a comfortable home with our professional coil cleaning service. |
| Coils | Chemical Coil Cleaning | DEFAULT_HVAC_SERVICE_12 |  | $0.00 | $150 | $299 | $475 |  |  | When your coils are heavily soiled, our chemical cleaning service is the solution. Our technicians use specialized cleaning agents to break down and remove stubborn dirt and grime, restoring your coils to like-new condition. With our chemical cleaning service, you can improve the efficiency of your HVAC system and enjoy cleaner, healthier air in your home. |
| Coils | Replace Coils | DEFAULT_HVAC_SERVICE_13 |  | $0.00 | $1,100 | $2,050 | $3,500 |  |  | If your coils are severely damaged or corroded, they may need to be replaced. Our expert technicians can assess the condition of your coils and recommend the best course of action. With our coil replacement service, you can restore your HVAC system's efficiency and performance, ensuring your home stays comfortable year-round. |
| Coils | Apply Coil Protection | DEFAULT_HVAC_SERVICE_14 |  | $0.00 | $375 | $445 | $1,099 |  |  | Extend the life of your coils with our coil protection service. Our technicians will apply protective coatings to your coils, preventing dirt buildup and corrosion. With our coil protection service, you can enjoy peace of mind knowing that your coils are protected against damage, helping your HVAC system run efficiently for years to come. |
| Coils | Repair Coils | DEFAULT_HVAC_SERVICE_15 |  | $0.00 | $149 | $435 | $1,704 |  |  | Restore your HVAC system's efficiency with our expert coil repair service. Our technicians are trained to repair coils that have leaks, damage, or corrosion, ensuring they function properly. By repairing your coils, you can avoid the cost of replacing them and keep your HVAC system running smoothly. Trust our technicians to provide reliable coil repair services and keep your home comfortable year-round. |
| Coils | Evaporator Clean | DEFAULT_HVAC_SERVICE_16 |  | $0.00 | $160 | $300 | $495 |  |  | Clean the evaporator to ensure optimal performance |
| Coils | Evaporator Coil Install | DEFAULT_HVAC_SERVICE_17 |  | $0.00 | $750 | $1,832 | $3,778 |  |  | Install a new evaporator coil including necessary components and system checks |
| Compressors | Replace Compressor | DEFAULT_HVAC_SERVICE_18 |  | $0.00 | $129 | $300 | $2,000 |  |  | Keep your HVAC system running smoothly with our compressor replacement service. When your compressor is beyond repair or not functioning properly, our technicians will replace it with a new unit. With our compressor replacement service, you can restore your HVAC system's performance and efficiency, ensuring your home stays comfortable year-round. |
| Compressors | Repair Compressor | DEFAULT_HVAC_SERVICE_19 |  | $0.00 | $250 | $945 | $1,952 |  |  | Restore your HVAC system's functionality with our compressor repair service. Our technicians will repair compressors that are malfunctioning or have failed, including replacing damaged components, fixing leaks, and recharging refrigerant. With our compressor repair service, you can avoid the cost of replacing your compressor and keep your HVAC system running smoothly. |
| Compressors | Test Acidity Levels | DEFAULT_HVAC_SERVICE_20 |  | $0.00 | $44 | $100 | $225 |  |  | Protect your HVAC system from damage with our acidity testing service. Our technicians will test the refrigerant sample for acidity using a pH test or other chemical analysis method. A high acidity level indicates the presence of acids that can damage the compressor and other system components. With our acidity testing service, you can identify and address acidity issues early, ensuring your HVAC system remains in good working condition. |
| Compressors | Compressor Replacement | DEFAULT_HVAC_SERVICE_21 |  | $0.00 | $765 | $1,877 | $3,500 |  |  | Replace the old compressor with a new one while ensuring proper system operation |
| Compressors | Install Hard Start Kit | DEFAULT_HVAC_SERVICE_22 |  | $0.00 | $318 | $405 | $607 |  |  | Install a hard start kit to enhance compressor startup efficiency and prolong its lifespan |
| Condensate Drain | Clean Drain Pan | DEFAULT_HVAC_SERVICE_23 |  | $0.00 | $125 | $184 | $295 |  |  | Ensure your HVAC system runs smoothly with our drain pan cleaning service. Our technicians will remove dirt, debris, and buildup from the drain pan to prevent clogs and ensure proper drainage. With our drain pan cleaning service, you can avoid water damage and keep your HVAC system functioning properly. |
| Condensate Drain | Clean Condensate Pump | DEFAULT_HVAC_SERVICE_24 |  | $0.00 | $81 | $138 | $225 |  |  | Maintain your condensate pump's efficiency with our pump cleaning service. Our technicians will clean the condensate pump to remove dirt and debris, ensuring it operates efficiently. With our pump cleaning service, you can prevent pump failure and maintain proper drainage from your HVAC system. |
| Condensate Drain | Clear & Flush Condensate Drain Line | DEFAULT_HVAC_SERVICE_25 |  | $0.00 | $125 | $178 | $249 |  |  | Prevent water damage with our drain line clearing and flushing service. Our technicians will remove obstructions and flush the condensate drain line to restore proper drainage. With our drain line service, you can avoid backups and ensure your HVAC system operates efficiently. |
| Condensate Drain | Replace Condensate Pump | DEFAULT_HVAC_SERVICE_26 |  | $0.00 | $228 | $389 | $595 |  |  | Restore proper drainage with our condensate pump replacement service. If your pump is malfunctioning or damaged, our technicians will install a new one. With our pump replacement service, you can avoid water damage and ensure your HVAC system operates efficiently. |
| Condensate Drain | Replace Condensate Drain Line | DEFAULT_HVAC_SERVICE_27 |  | $0.00 | $149 | $254 | $492 |  |  | Ensure proper drainage from your HVAC system with our drain line replacement service. Our technicians will install a new drain line to replace a damaged or clogged line. With our drain line replacement service, you can prevent backups and water damage, keeping your home safe and comfortable. |
| Condensate Drain | Maintain Drainage Systems | DEFAULT_HVAC_SERVICE_28 |  | $0.00 | $100 | $150 | $250 |  |  | Maintain and clean HVAC drainage systems to prevent clogs and ensure proper water flow. |
| Condensate Drain | Install Drain Pan Switch | DEFAULT_HVAC_SERVICE_29 |  | $0.00 | $159 | $285 | $500 |  |  | Install a new drain pan switch to prevent overflow of water |
| Condenser | Clean Condenser Coil | DEFAULT_HVAC_SERVICE_30 |  | $0.00 | $126 | $230 | $389 |  |  | Keep your HVAC system running efficiently with our condenser coil cleaning service. Our technicians will remove dirt, debris, and buildup from the condenser coil, improving heat transfer and system efficiency. With our condenser coil cleaning service, you can enjoy a cooler home and lower energy bills. |
| Condenser | Level and Adjust Condenser with Risers | DEFAULT_HVAC_SERVICE_31 |  | $0.00 | $200 | $350 | $600 |  |  | Ensure your condenser unit operates properly with our condenser leveling service. Using risers, our technicians will adjust and level the condenser unit for proper operation and drainage. With our condenser leveling service, you can prevent issues caused by improper unit placement and ensure your HVAC system runs smoothly. |
| Condenser | Perform Leak Check | DEFAULT_HVAC_SERVICE_32 |  | $0.00 | $99 | $150 | $250 |  |  | Protect your HVAC system from refrigerant leaks with our leak check service. Our technicians will inspect the condenser unit for leaks to prevent loss of refrigerant and ensure system efficiency. With our leak check service, you can avoid costly repairs and keep your HVAC system running efficiently. |
| Condenser | Replace Liquid/Suction Valve | DEFAULT_HVAC_SERVICE_33 |  | $0.00 | $300 | $553 | $1,150 |  |  | Maintain proper refrigerant flow and system function with our valve replacement service. Our technicians will replace the liquid or suction valve in the condenser unit to ensure optimal performance. With our valve replacement service, you can avoid issues caused by a faulty valve and keep your HVAC system running smoothly. |
| Condenser | Service Condenser Fan Motor | DEFAULT_HVAC_SERVICE_34 |  | $0.00 | $215 | $530 | $850 |  |  | Ensure proper airflow and cooling of the refrigerant with our fan motor repair or replacement service. Our technicians will repair or replace the condenser fan motor to ensure optimal performance. With our fan motor service, you can avoid overheating issues and keep your HVAC system running efficiently. |
| Condenser | Service Condenser Fan Motor and Blade | DEFAULT_HVAC_SERVICE_35 |  | $0.00 | $392 | $650 | $955 |  |  | Enhance your HVAC system's performance with our fan motor and fan blade replacement service. Our technicians will replace both the condenser fan motor and fan blade, ensuring optimal airflow and performance. With our replacement service, you can enjoy improved cooling and efficiency in your HVAC system. |
| Condenser | Replace Condenser Fan Blade | DEFAULT_HVAC_SERVICE_36 |  | $0.00 | $175 | $320 | $580 |  |  | Improve airflow and cooling efficiency with our fan blade repair or replacement service. Our technicians will repair or replace the condenser fan blade to ensure proper airflow and cooling of the refrigerant. With our fan blade service, you can prevent issues caused by a damaged blade and keep your HVAC system running smoothly. |
| Condenser | Remount/Realign Condenser Fan Blade | DEFAULT_HVAC_SERVICE_37 |  | $0.00 | $148 | $331 | $554 |  |  | Ensure your condenser unit operates smoothly with our fan blade remounting and realignment service. Our technicians will adjust the position of the fan blade and remount it to ensure proper alignment and airflow. With our service, you can prevent issues caused by improper fan blade alignment and keep your condenser unit running efficiently. |
| Condenser | Install Condenser Fan Motor | DEFAULT_HVAC_SERVICE_38 |  | $0.00 | $225 | $484 | $756 |  |  | Install a condenser fan motor with specified horsepower and RPM |
| Condenser | Install Condensers | DEFAULT_HVAC_SERVICE_39 |  | $0.00 | $285 | $900 | $2,500 |  |  | Install HVAC condenser units with proper mounting and system integration. |
| Fan Belts | Adjust Belt and Pulley | DEFAULT_HVAC_SERVICE_40 |  | $0.00 | $175 | $225 | $540 |  |  | Keep your HVAC system running smoothly with our belt and pulley adjustment service. Our technicians will adjust the tension or alignment of the belt and pulley system to ensure proper operation and reduce wear. With our adjustment service, you can avoid belt slipping and premature wear, ensuring your HVAC system operates efficiently. |
| Fan Belts | Replace Belt | DEFAULT_HVAC_SERVICE_41 |  | $0.00 | $140 | $188 | $363 |  |  | Ensure your HVAC system operates efficiently with our belt replacement service. Our technicians will install a new belt to replace a worn or damaged belt, ensuring proper operation. With our belt replacement service, you can avoid belt failure and maintain optimal performance in your HVAC system. |
| Fan Belts | Replace Blower Pulley | DEFAULT_HVAC_SERVICE_42 |  | $0.00 | $285 | $407 | $913 |  |  | Maintain proper operation of your HVAC system with our blower pulley replacement service. Our technicians will install a new blower pulley to replace a worn or damaged pulley, ensuring proper operation of the blower motor. With our pulley replacement service, you can avoid blower motor issues and keep your HVAC system running smoothly. |
| Filters | Replace Air Filter | DEFAULT_HVAC_SERVICE_43 |  | $0.00 | $80 | $150 | $375 |  |  | Ensure your indoor air is clean and your HVAC system runs efficiently with our air filter replacement service. Our technicians will replace your air filters, removing dust, pollen, and other particles from the air. Regular air filter replacement helps maintain clean indoor air and optimizes your HVAC system's performance, keeping your home comfortable and your air quality high. |
| Filters | Clean Air Ducts | DEFAULT_HVAC_SERVICE_44 |  | $0.00 | $399 | $700 | $1,200 |  |  | Improve your indoor air quality and HVAC system efficiency with our air duct cleaning service. Our technicians will remove dust, debris, and contaminants from your air ducts, ensuring that only clean air is circulated throughout your home. With our air duct cleaning service, you can breathe easier and enjoy a healthier home environment. |
| Filters | Perform IAQ Testing | DEFAULT_HVAC_SERVICE_45 |  | $0.00 | $99 | $150 | $1,044 |  |  | Curious about your indoor air quality? Our indoor air quality testing service can provide you with answers. Our technicians will conduct tests to assess the levels of pollutants and contaminants in your home, helping you identify potential issues. With our indoor air quality testing service, you can take steps to improve your indoor air quality and create a healthier home for you and your family. |
| Filters | Install UV Air Purification System | DEFAULT_HVAC_SERVICE_46 |  | $0.00 | $550 | $868 | $1,400 |  |  | Improve your indoor air quality with our UV air purification installation service. Our technicians will install ultraviolet (UV) light systems in your HVAC system, killing mold, bacteria, and viruses in the air. With our UV air purification installation service, you can breathe easier knowing that your indoor air is clean and free of harmful pathogens. |
| Filters | Seal and Insulate Ducts | DEFAULT_HVAC_SERVICE_47 |  | $0.00 | $375 | $850 | $2,460 |  |  | Improve your energy efficiency and indoor air quality with our duct sealing and insulation service. Our technicians will seal and insulate your ductwork, preventing air leaks and ensuring that only clean, conditioned air is circulated throughout your home. With our duct sealing and insulation service, you can save money on your energy bills and enjoy a more comfortable home environment. |
| Filters | Replace Hvac Uv Bulbs | DEFAULT_HVAC_SERVICE_48 |  | $0.00 | $294 | $580 | $1,033 |  |  | Install and replace UV bulbs in HVAC systems to improve air purification. |
| General Maintenance & Controls | Furnace cleaning | DEFAULT_HVAC_SERVICE_49 |  | $0.00 | $114 | $200 | $495 |  |  | Clean the furnace and its vents |
| General Maintenance & Controls | Maintain Hvac Capacitors | DEFAULT_HVAC_SERVICE_50 |  | $0.00 | $175 | $249 | $325 |  |  | Maintain HVAC capacitors to ensure proper motor start-up and operation. |
| General Maintenance & Controls | Repair Hvac Defrost Boards | DEFAULT_HVAC_SERVICE_51 |  | $0.00 | $104 | $200 | $425 |  |  | Diagnose and repair faulty defrost boards in HVAC units. |
| General Maintenance & Controls | Seal Attic And Crawlspace | DEFAULT_HVAC_SERVICE_52 |  | $0.00 | $278 | $550 | $1,200 |  |  | Seal all potential entry points in the attic and crawlspace to prevent air leakage and rodent entry |
| General Maintenance & Controls | Capacitor Replacement | DEFAULT_HVAC_SERVICE_53 |  | $0.00 | $135 | $219 | $300 |  |  | Replace the bad capacitor to restore proper cooling functionality |
| General Maintenance & Controls | Replace Hvac Contactors | DEFAULT_HVAC_SERVICE_54 |  | $0.00 | $180 | $280 | $395 |  |  | Replace electrical contactors to restore reliable HVAC system operation. |
| General Maintenance & Controls | Install Blown-In Insulation | DEFAULT_HVAC_SERVICE_55 |  | $0.00 | $1,422 | $2,625 | $4,258 |  |  | Install new blown-in fiberglass insulation to achieve specified R-values in the attic area |
| General Maintenance & Controls | Ac Tune Up | DEFAULT_HVAC_SERVICE_56 |  | $0.00 | $89 | $119 | $158 |  |  | Perform an AC tune up to ensure the system is operating properly |
| General Maintenance & Controls | Thermostat Wiring Service | DEFAULT_HVAC_SERVICE_57 |  | $0.00 | $98 | $175 | $350 |  |  | Inspect or replace thermostat wiring to ensure accurate temperature control and system reliability. |
| General Maintenance & Controls | Install Control Board | DEFAULT_HVAC_SERVICE_58 |  | $0.00 | $224 | $399 | $682 |  |  | Install the control board for optimal appliance functionality |
| General Maintenance & Controls | Replace And Install Fuses | DEFAULT_HVAC_SERVICE_59 |  | $0.00 | $150 | $300 | $790 |  |  | Replace and install HVAC fuses with warranty coverage for safe electrical protection. |
| General Maintenance & Controls | Install  Hvac Surge Protectors | DEFAULT_HVAC_SERVICE_60 |  | $0.00 | $345 | $488 | $672 |  |  | Install protection devices to safeguard HVAC systems from power surges. |
| General Maintenance & Controls | Repair Hvac Insulation | DEFAULT_HVAC_SERVICE_61 |  | $0.00 | $100 | $250 | $750 |  |  | Inspect and repair damaged insulation to improve HVAC system efficiency and reduce energy loss. |
| General Maintenance & Controls | Maintain Hvac Generators | DEFAULT_HVAC_SERVICE_62 |  | $0.00 | $145 | $250 | $369 |  |  | Maintain generators to provide backup power for HVAC systems. |
| General Maintenance & Controls | Thermostat Repair | DEFAULT_HVAC_SERVICE_63 |  | $0.00 | $89 | $140 | $250 |  |  | Repair thermostat issues to ensure accurate temperature control. |
| General Maintenance & Controls | Repair Control Boards | DEFAULT_HVAC_SERVICE_64 |  | $0.00 | $250 | $495 | $850 |  |  | Repair HVAC control boards for reliable system operation. |
| General Maintenance & Controls | Furnace Maintenance | DEFAULT_HVAC_SERVICE_65 |  | $0.00 | $100 | $150 | $200 |  |  | Perform regular maintenance on the furnace to ensure optimal operation and safety |
| Heat Exchangers | Clean and Check Burner Exchanger | DEFAULT_HVAC_SERVICE_66 |  | $0.00 | $99 | $140 | $189 |  |  | Keep your furnace running efficiently with our burner cleaning and checking service. Our technicians will clean the burner of the heat exchanger and check it for proper operation to ensure efficient heating. With our service, you can avoid issues caused by a dirty or malfunctioning burner and enjoy a warm and comfortable home. |
| Heat Exchangers | Replace Heat Exchanger | DEFAULT_HVAC_SERVICE_67 |  | $0.00 | $225 | $1,003 | $2,996 |  |  | Ensure safe and efficient operation of your furnace with our heat exchanger replacement service. Our technicians will install a new heat exchanger to replace a damaged or malfunctioning one. With our replacement service, you can avoid the risk of carbon monoxide leaks and maintain a warm and safe home. |
| Heat Exchangers | Replace Face Plate | DEFAULT_HVAC_SERVICE_68 |  | $0.00 | $388 | $650 | $1,184 |  |  | Improve heat transfer and sealing with our face plate replacement service. Our technicians will install a new face plate on the heat exchanger to replace a damaged or corroded one, ensuring proper sealing and heat transfer. With our replacement service, you can improve the efficiency of your furnace and enjoy a more comfortable home. |
| Heat Exchangers | Replace Or Install Hvac Flue Pipe | DEFAULT_HVAC_SERVICE_69 |  | $0.00 | $350 | $685 | $1,498 |  |  | Replace or install flue pipe to ensure proper ventilation and exhaust flow. |
| Refrigerant | Check Refrigerant Levels | DEFAULT_HVAC_SERVICE_70 |  | $0.00 | $99 | $129 | $199 |  |  | Ensure your HVAC system operates efficiently with our refrigerant level check service. Our technicians will check the refrigerant levels to ensure they are at the correct level for optimal performance. With our refrigerant level check service, you can avoid potential issues and maintain a comfortable indoor environment. |
| Refrigerant | Add 410-A Refrigerant (per pound) | DEFAULT_HVAC_SERVICE_71 |  | $0.00 | $150 | $311 | $630 |  |  | Maintain your HVAC system with our R-410A refrigerant charging service. Our technicians will charge the system with R-410A refrigerant at a specified rate per pound. With our R-410A refrigerant charging service, you can ensure your HVAC system operates at peak performance. |
| Refrigerant | Add Additional 410-A Refrigerant (per pound) | DEFAULT_HVAC_SERVICE_72 |  | $0.00 | $160 | $300 | $600 |  |  | Keep your HVAC system running smoothly with our additional R-410A refrigerant service. If your system requires extra refrigerant beyond the initial charge, our technicians will add it at a specified rate per pound. With our additional R-410A refrigerant service, you can maintain optimal performance and efficiency in your HVAC system. |
| Refrigerant | Add R-22 Refrigerant (per pound) | DEFAULT_HVAC_SERVICE_73 |  | $0.00 | $97 | $200 | $455 |  |  | Maintain your HVAC system with our R-22 refrigerant charging service. Our technicians will charge the system with R-22 refrigerant at a specified rate per pound. With our R-22 refrigerant charging service, you can ensure your HVAC system operates at peak performance. |
| Refrigerant | Add Additional R-22 Refrigerant (per pound) | DEFAULT_HVAC_SERVICE_74 |  | $0.00 | $150 | $288 | $588 |  |  | Keep your HVAC system running smoothly with our additional R-22 refrigerant service. If your system requires extra refrigerant beyond the initial charge, our technicians will add it at a specified rate per pound. With our additional R-22 refrigerant service, you can maintain optimal performance and efficiency in your HVAC system. |
| Refrigerant | Perform Leak Search | DEFAULT_HVAC_SERVICE_75 |  | $0.00 | $179 | $275 | $425 |  |  | Protect your HVAC system from leaks with our leak check service. Our technicians will inspect the system for refrigerant leaks using specialized tools and techniques. With our leak check service, you can identify and address potential leaks before they cause significant damage to your system. |
| Refrigerant | Repair Leaks | DEFAULT_HVAC_SERVICE_76 |  | $0.00 | $200 | $389 | $700 |  |  | Ensure your HVAC system remains leak-free with our detailed leak search service. Our technicians will conduct a thorough search to locate and identify any refrigerant leaks in the system. With our leak search service, you can rest assured that your HVAC system is free from leaks and operating efficiently. |
| Refrigerant | Leak Repair | DEFAULT_HVAC_SERVICE_77 |  | $0.00 | $237 | $395 | $750 |  |  | Prevent further loss of refrigerant with our leak repair service. If any leaks are identified in your HVAC system, our technicians will repair them to ensure your system remains leak-free. With our leak repair service, you can maintain optimal performance and efficiency in your HVAC system. |
| Refrigerant | Leak Search Service | DEFAULT_HVAC_SERVICE_78 |  | $0.00 | $85 | $169 | $268 |  |  | Conduct a leak search using electronic leak detectors |
| Refrigerant | Walk-In Freezer Reversing Valve Replacement | DEFAULT_HVAC_SERVICE_79 |  | $0.00 | $190 | $467 | $1,350 |  |  | Replace reversing valve and perform diagnostics on walk-in freezer, including defrost control and sensor replacement. |
| Refrigerant | Repair Hvac Lineset | DEFAULT_HVAC_SERVICE_80 |  | $0.00 | $235 | $600 | $1,450 |  |  | Repair line sets, and ensure proper system operation and ductwork modifications. |
| Refrigerant | Flush Hvac Lineset | DEFAULT_HVAC_SERVICE_81 |  | $0.00 | $110 | $185 | $350 |  |  | Flush HVAC lineset |
| Refrigerant | Txv Replacement Service | DEFAULT_HVAC_SERVICE_82 |  | $0.00 | $450 | $910 | $1,600 |  |  | Remove the existing thermal expansion valve and installation of a new one to ensure proper refrigerant flow |
| Repair Services | Diagnostic Service (Residential) | DEFAULT_HVAC_SERVICE_83 |  | $0.00 | $85 | $99 | $124 |  |  | With our diagnostic service, we'll thoroughly inspect your system to pinpoint the issue. This includes checking your thermostat, inspecting the air filters, testing the electrical connections, and evaluating the overall performance of your HVAC system. Once we identify the problem, we'll provide you with a detailed explanation and our recommended solution. We'll always explain everything in plain language, so you understand exactly what's going on with your system. Trust us to keep your home comfortable all year round! |
| Repair Services | Diagnostic Service (Commercial) | DEFAULT_HVAC_SERVICE_84 |  | $0.00 | $89 | $100 | $135 |  |  | Our technicians will quickly assess your system to identify any problems. If you approve the estimate for repairs or replacements during the same visit, we'll waive the diagnostic fee. Stay focused on your business while we ensure your HVAC keeps your customers and employees comfortable. Schedule your diagnostic service today! |
| Repair Services | Diagnostic Service (Emergency) | DEFAULT_HVAC_SERVICE_85 |  | $0.00 | $89 | $105 | $150 |  |  | Facing an HVAC emergency after hours? Don't worry, our on-call technician is ready to assist! They will swiftly diagnose your system and identify the issue, providing you with clear, understandable explanations and options for repair. Rest assured, we'll work efficiently to restore your comfort and peace of mind. Contact us now, and we'll dispatch our skilled technician to your location promptly! |
| Repair Services | Diagnostic Service (Out of Range) | DEFAULT_HVAC_SERVICE_86 |  | $0.00 | $89 | $100 | $125 |  |  | If you're located outside our service area, don't worry! Our diagnostic service is available to you as well. When you can't find someone in your area to address your HVAC system issues, our experienced technicians are here to help. We can remotely diagnose the problem with your HVAC system and provide you with a detailed report and recommendations for repairs or next steps. If necessary, we can also make a trip out to your location for an additional cost. With our diagnostic service, you can count on us to assist you, no matter where you are. |
| System Installation | Install 3.5-Ton Split HVAC System | DEFAULT_HVAC_SERVICE_87 |  | $0.00 | $6,998 | $9,480 | $12,900 |  |  | Install 3.5-ton air handler, condenser, and heat kit with duct sealing and warranties. |
| System Installation | Install 4-Ton Split Ac System | DEFAULT_HVAC_SERVICE_88 |  | $0.00 | $5,700 | $8,800 | $12,162 |  |  | Complete installation of a 4-ton split AC unit with removal of old equipment and connection to existing systems. |
| System Installation | Install 2.5 Ton Heat Pump System | DEFAULT_HVAC_SERVICE_89 |  | $0.00 | $6,200 | $8,423 | $11,315 |  |  | Remove old HVAC system and install a 2.5-ton heat pump for heating and cooling. |
| System Installation | Install And Service Hvac Dehumidifiers | DEFAULT_HVAC_SERVICE_90 |  | $0.00 | $380 | $1,474 | $4,042 |  |  | Install multiple dehumidifiers with ducting, ensure proper sealing, and perform diagnostics on HVAC systems. |
| System Installation | Install Hvac Ductwork | DEFAULT_HVAC_SERVICE_91 |  | $0.00 | $600 | $1,653 | $4,840 |  |  | Install ductwork for proper air distribution. |
| System Installation | Install Air Handler | DEFAULT_HVAC_SERVICE_92 |  | $0.00 | $450 | $1,242 | $3,027 |  |  | Install HVAC air handler units with proper connections and setup. |
| System Installation | Repair Heat Pump | DEFAULT_HVAC_SERVICE_93 |  | $0.00 | $130 | $249 | $984 |  |  | Repair heat pump systems to restore efficiency. |
| System Installation | Install Ductless Mini Split System | DEFAULT_HVAC_SERVICE_94 |  | $0.00 | $1,174 | $3,600 | $6,500 |  |  | Install and configure ductless mini split system with necessary components and warranties for optimal performance. |
| System Installation | Install 2-3.5 Ton Hvac System | DEFAULT_HVAC_SERVICE_95 |  | $0.00 | $2,800 | $5,763 | $8,700 |  |  | Install and configure 2-3.5 ton HVAC system with necessary components and accessories. |
| System Installation | Boiler Installation And Zone Valve Replacement | DEFAULT_HVAC_SERVICE_96 |  | $0.00 | $350 | $1,183 | $4,739 |  |  | Install customer-supplied boiler, replace zone valves, rerun gas pipe, and ensure compliance with inspection standards. |
| System Installation | Install Cold-Climate Hyper-Heat Systems | DEFAULT_HVAC_SERVICE_97 |  | $0.00 | $4,747 | $7,832 | $12,995 |  |  | Install cold-climate mini-split heat pump systems for high-efficiency heating in low temperatures. |
| System Installation | Install Hvac Generators | DEFAULT_HVAC_SERVICE_98 |  | $0.00 | $275 | $1,260 | $5,406 |  |  | Install generators to provide backup power for HVAC systems. |
| System Installation | Install 5 Ton Hvac System | DEFAULT_HVAC_SERVICE_99 |  | $0.00 | $5,512 | $9,249 | $13,175 |  |  | Install and configure a 5-ton HVAC system with air handler, condenser, and furnace including necessary modifications. |
| System Installation | Install Multi-Zone Mini Split System | DEFAULT_HVAC_SERVICE_100 |  | $0.00 | $1,254 | $4,261 | $8,750 |  |  | Install and configure a multi-zone mini split system with all necessary components and warranties. |
| System Installation | Relocate Hvac Systems | DEFAULT_HVAC_SERVICE_101 |  | $0.00 | $178 | $647 | $2,080 |  |  | Relocate HVAC systems , install components, and perform precision tune-up for optimal performance. |
| System Installation | Install Mini Split Condenser System | DEFAULT_HVAC_SERVICE_102 |  | $0.00 | $600 | $2,525 | $5,217 |  |  | Install and test mini split condenser, including wiring, copper lineset connection, and leak verification. |

## Carpet Cleaning

- Services: **50** (50 with a task code, 0 without) in **4** categories (` > ` = nested subcategory): Add-On & Protection, Book Now, Core Carpet Cleaning, Specialty Cleaning & Repair
- Pricing insight available for 6 of 50 services; median of medians **$98**
- Industry card image seeded: yes (stock photo)

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Add-On & Protection | Pet Stain & Odor Treatment (Carpet & Upholstery) | DEFAULT_CARPET_SERVICE_0 |  | $0.00 |  |  |  |  |  | Targeted enzyme-based treatment to break down pet stains and neutralize odors at the source, improving cleanliness and indoor air quality. |
| Add-On & Protection | Carpet Protector Add-On (Carpet/Fabric Protector) | DEFAULT_CARPET_SERVICE_1 |  | $0.00 |  |  |  |  |  | Application of protective coating after cleaning to help resist future stains, spills, and wear, extending the life of carpets and fabrics. |
| Add-On & Protection | Odor Neutralization (Whole Area Treatment) | DEFAULT_CARPET_SERVICE_2 |  | $0.00 | $20 | $40 | $65 |  |  | Enhanced odor treatment beyond standard deodorizer for persistent odors, applied to the specified area(s). |
| Book Now | Professional Carpet Deep Cleaning | DEFAULT_CARPET_SERVICE_3 |  | $0.00 |  |  |  | 120 | yes | Deep cleaning service to remove stains, odors, and embedded dirt. |
| Book Now | Pet Stain & Odor Treatment | DEFAULT_CARPET_SERVICE_4 |  | $0.00 |  |  |  | 120 | yes | Targeted treatment to eliminate pet-related stains and smells. |
| Book Now | High-Traffic Carpet Refresh | DEFAULT_CARPET_SERVICE_5 |  | $0.00 |  |  |  | 120 | yes | Restore worn areas and extend carpet life. |
| Book Now | Carpet Cleaning - 1 Room | DEFAULT_CARPET_SERVICE_6 |  | $0.00 |  |  |  | 120 | yes | Deep cleaning for a single carpeted room using pre-treatment and hot water extraction to remove dirt, stains, and allergens while restoring carpet appearance. |
| Book Now | Carpet Cleaning - 2 Rooms | DEFAULT_CARPET_SERVICE_7 |  | $0.00 |  |  |  | 120 | yes | Professional carpet cleaning for two rooms using steam extraction to lift embedded dirt and refresh high-traffic areas. |
| Book Now | Carpet Cleaning - 3 Rooms | DEFAULT_CARPET_SERVICE_8 |  | $0.00 |  |  |  | 120 | yes | Thorough carpet cleaning across three rooms, targeting buildup, stains, and odors for a cleaner and more uniform finish. |
| Book Now | Whole-Home Carpet Cleaning | DEFAULT_CARPET_SERVICE_9 |  | $0.00 |  |  |  | 120 | yes | Full-home carpet cleaning service using professional equipment to remove dirt, allergens, and odors across all carpeted areas. |
| Book Now | Pet Stain & Odor Treatment | DEFAULT_CARPET_SERVICE_10 |  | $0.00 |  |  |  | 120 | yes | Targeted enzyme-based treatment to break down pet stains and neutralize odors at the source for a cleaner, fresher home. |
| Core Carpet Cleaning | Carpet Cleaning (Up to 250 sq ft) | DEFAULT_CARPET_SERVICE_11 |  | $0.00 |  |  |  |  |  | Deep cleaning of carpeted area up to 250 sq ft using pre-treatment and hot water extraction (steam cleaning) to remove dirt, allergens, and buildup while restoring carpet appearance. |
| Core Carpet Cleaning | Carpet Cleaning (Per Room - Standard) | DEFAULT_CARPET_SERVICE_12 |  | $0.00 |  |  |  |  |  | Professional carpet cleaning for one room using pre-treatment and hot water extraction to lift embedded dirt, refresh fibers, and improve overall cleanliness. |
| Core Carpet Cleaning | Carpet Cleaning Bundle (2 Rooms + Hallway) | DEFAULT_CARPET_SERVICE_13 |  | $0.00 |  |  |  |  |  | Comprehensive carpet cleaning for two rooms and one hallway, including pre-treatment, steam cleaning, and deodorizing for a consistent, refreshed finish. |
| Core Carpet Cleaning | Carpet Cleaning - Vacant Unit (2BR + Common Areas) | DEFAULT_CARPET_SERVICE_14 |  | $0.00 |  |  |  |  |  | Full carpet cleaning for a vacant two-bedroom unit, including bedrooms and common areas, using deep extraction methods to prepare the space for new occupants. |
| Core Carpet Cleaning | Carpet Cleaning - 1 Room | DEFAULT_CARPET_SERVICE_15 |  | $0.00 |  |  |  |  |  | Deep cleaning for a single carpeted room using professional equipment to remove dirt, stains, and allergens while restoring carpet texture. |
| Core Carpet Cleaning | Carpet Cleaning - 2 Rooms | DEFAULT_CARPET_SERVICE_16 |  | $0.00 |  |  |  |  |  | Professional carpet cleaning for two rooms using pre-treatment and steam extraction to improve appearance and extend carpet life. |
| Core Carpet Cleaning | Carpet Cleaning - 3 Rooms | DEFAULT_CARPET_SERVICE_17 |  | $0.00 |  |  |  |  |  | Thorough carpet cleaning across three rooms using deep extraction methods to remove buildup and refresh high-traffic areas. |
| Core Carpet Cleaning | Carpet Cleaning - 4 Rooms | DEFAULT_CARPET_SERVICE_18 |  | $0.00 |  |  |  |  |  | Full-service carpet cleaning for four rooms, targeting dirt, allergens, and wear patterns to restore a clean and uniform look. |
| Core Carpet Cleaning | Carpet Cleaning - 5+ Rooms | DEFAULT_CARPET_SERVICE_19 |  | $0.00 |  |  |  |  |  | Whole-home or large-area carpet cleaning designed to handle multiple rooms, delivering consistent deep cleaning across all spaces. |
| Core Carpet Cleaning | Carpet Cleaning - Hallway | DEFAULT_CARPET_SERVICE_20 |  | $0.00 |  |  |  |  |  | Targeted carpet cleaning for hallway areas, focusing on high-traffic zones to remove buildup and restore appearance. |
| Core Carpet Cleaning | Carpet Cleaning (Up to 3 Areas) | DEFAULT_CARPET_SERVICE_21 |  | $0.00 |  |  |  |  |  | Deep cleaning for up to three designated carpeted areas using pre-treatment and hot water extraction to remove dirt and refresh fibers. |
| Core Carpet Cleaning | Whole-Home Carpet Cleaning + Stain Removal | DEFAULT_CARPET_SERVICE_22 |  | $0.00 |  |  |  |  |  | Complete carpet cleaning throughout the home with targeted stain removal to address problem areas and restore a clean, uniform finish. |
| Core Carpet Cleaning | Carpet Cleaning - Whole House | DEFAULT_CARPET_SERVICE_23 |  | $0.00 |  |  |  |  |  | Full-home carpet cleaning service using professional-grade equipment to remove dirt, allergens, and odors across all carpeted areas. |
| Core Carpet Cleaning | Recurring - Carpet Cleaning | DEFAULT_CARPET_SERVICE_24 |  | $0.00 |  |  |  |  |  | Scheduled carpet cleaning service designed to maintain cleanliness, reduce buildup, and extend carpet life over time. |
| Core Carpet Cleaning | Carpet Cleaning - Stairs (Up to 16 Steps) | DEFAULT_CARPET_SERVICE_25 |  | $0.00 | $50 | $70 | $100 |  |  | Clean carpeted stairs (up to 16 steps) using pre-spray and hot water extraction/steam cleaning. |
| Specialty Cleaning & Repair | Carpet Stretching (De-Wrinkle) | DEFAULT_CARPET_SERVICE_26 |  | $0.00 |  |  |  |  |  | Re-stretching and re-securing carpet to remove wrinkles, ripples, and loose areas, improving both appearance and safety. |
| Specialty Cleaning & Repair | Tile & Grout Cleaning | DEFAULT_CARPET_SERVICE_27 |  | $0.00 |  |  |  |  |  | Deep cleaning of tile and grout using specialized solutions and agitation to remove embedded dirt, discoloration, and buildup. |
| Specialty Cleaning & Repair | Tile & Grout Cleaning - Hallway | DEFAULT_CARPET_SERVICE_28 |  | $0.00 |  |  |  |  |  | Focused tile and grout cleaning for hallway areas, targeting high-traffic buildup and restoring grout color. |
| Specialty Cleaning & Repair | Tile & Grout Cleaning - 2 Rooms | DEFAULT_CARPET_SERVICE_29 |  | $0.00 |  |  |  |  |  | Deep cleaning of tile and grout across two rooms to remove dirt and restore a cleaner, brighter surface. |
| Specialty Cleaning & Repair | Tile & Grout Cleaning - 3 Rooms | DEFAULT_CARPET_SERVICE_30 |  | $0.00 |  |  |  |  |  | Professional tile and grout cleaning for three rooms, improving appearance and removing embedded grime. |
| Specialty Cleaning & Repair | Tile & Grout Cleaning - 4 Rooms | DEFAULT_CARPET_SERVICE_31 |  | $0.00 |  |  |  |  |  | Comprehensive cleaning of tile and grout across four rooms, restoring surface cleanliness and consistency. |
| Specialty Cleaning & Repair | Tile & Grout Cleaning - 5+ Rooms | DEFAULT_CARPET_SERVICE_32 |  | $0.00 |  |  |  |  |  | Large-area tile and grout cleaning designed for multiple rooms, delivering consistent results across all surfaces. |
| Specialty Cleaning & Repair | Tile & Grout Cleaning - Stairs | DEFAULT_CARPET_SERVICE_33 |  | $0.00 |  |  |  |  |  | Detailed cleaning of tile and grout on stairs to remove buildup and improve traction and appearance. |
| Specialty Cleaning & Repair | Natural Stone Cleaning - Stairs | DEFAULT_CARPET_SERVICE_34 |  | $0.00 |  |  |  |  |  | Specialized cleaning of natural stone stair surfaces using appropriate products to safely remove buildup while preserving the material. |
| Specialty Cleaning & Repair | Natural Stone Cleaning - Backsplash | DEFAULT_CARPET_SERVICE_35 |  | $0.00 |  |  |  |  |  | Careful cleaning of natural stone backsplash surfaces to remove grease, buildup, and discoloration without damaging the finish. |
| Specialty Cleaning & Repair | Furniture Cleaning - Sectional | DEFAULT_CARPET_SERVICE_36 |  | $0.00 |  |  |  |  |  | Deep cleaning of sectional upholstery using fabric-safe methods to remove dirt, oils, and stains while refreshing appearance. |
| Specialty Cleaning & Repair | Leather Furniture Cleaning - Chairs | DEFAULT_CARPET_SERVICE_37 |  | $0.00 |  |  |  |  |  | Professional cleaning and conditioning of leather chairs to remove buildup while preserving the material’s texture and durability. |
| Specialty Cleaning & Repair | Leather Furniture Cleaning - Sofa | DEFAULT_CARPET_SERVICE_38 |  | $0.00 |  |  |  |  |  | Deep cleaning and conditioning of leather sofas to restore appearance and maintain long-term material quality. |
| Specialty Cleaning & Repair | Leather Furniture Cleaning - Sectional | DEFAULT_CARPET_SERVICE_39 |  | $0.00 |  |  |  |  |  | Detailed cleaning and conditioning of leather sectional furniture to remove dirt and extend the life of the material. |
| Specialty Cleaning & Repair | Mattress Cleaning - Full | DEFAULT_CARPET_SERVICE_40 |  | $0.00 |  |  |  |  |  | Deep cleaning of a full-size mattress to remove dust, allergens, and buildup, improving hygiene and sleep quality. |
| Specialty Cleaning & Repair | Mattress Cleaning - California King | DEFAULT_CARPET_SERVICE_41 |  | $0.00 |  |  |  |  |  | Professional cleaning of a California king mattress to eliminate allergens, dust, and contaminants for a cleaner sleeping environment. |
| Specialty Cleaning & Repair | Recurring - Hard-Surface Floor Cleaning | DEFAULT_CARPET_SERVICE_42 |  | $0.00 |  |  |  |  |  | Recurring cleaning service for tile, stone, or other hard surfaces to maintain appearance and prevent buildup between deep cleanings. |
| Specialty Cleaning & Repair | Carpet Cleaning - Other | DEFAULT_CARPET_SERVICE_43 |  | $0.00 |  |  |  |  |  | General carpet cleaning service for custom or unspecified areas, using professional methods to remove dirt and refresh surfaces. |
| Specialty Cleaning & Repair | Move In/Out Cleaning - 1 Bed / 1 Bath | DEFAULT_CARPET_SERVICE_44 |  | $0.00 |  |  |  |  |  | Comprehensive cleaning service for a one-bedroom unit during move-in or move-out, ensuring the space is clean, sanitized, and ready for occupancy. |
| Specialty Cleaning & Repair | One-Time Cleaning - 1 Bed / 1 Bath | DEFAULT_CARPET_SERVICE_45 |  | $0.00 |  |  |  |  |  | One-time professional cleaning service for a one-bedroom home, covering essential areas to restore cleanliness and comfort. |
| Specialty Cleaning & Repair | Area Rug Cleaning (On-Site, 8x10 Synthetic) | DEFAULT_CARPET_SERVICE_46 |  | $0.00 | $75 | $140 | $240 |  |  | On-site cleaning of one synthetic area rug sized 8x10 using a rug-appropriate method. |
| Specialty Cleaning & Repair | Area Rug Cleaning (Various Sizes/Materials) | DEFAULT_CARPET_SERVICE_47 |  | $0.00 | $60 | $115 | $200 |  |  | Cleaning of area rugs of various sizes and materials (synthetic or natural fiber) using a rug-appropriate method. |
| Specialty Cleaning & Repair | Upholstery Cleaning (Sofa/Chair/Loveseat) | DEFAULT_CARPET_SERVICE_48 |  | $0.00 | $95 | $149 | $200 |  |  | Clean upholstered furniture pieces (sofas, chairs, loveseats) using an upholstery-safe method to remove dirt and stains. |
| Specialty Cleaning & Repair | Stairs & Glass Detail Cleaning | DEFAULT_CARPET_SERVICE_49 |  | $0.00 | $52 | $81 | $180 |  |  | Clean and dust main-floor stairs and detail-clean glass surfaces for a spot-free finish. |

## Home Cleaning

- Services: **39** (39 with a task code, 0 without) in **6** categories (` > ` = nested subcategory): Add-On Services, Book Now, Commercial Cleaning, Core Home Cleaning, Move-In / Move-Out Cleaning, Recurring Cleaning
- Pricing insight available for 7 of 39 services; median of medians **$150**
- Industry card image seeded: yes (stock photo)

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Add-On Services | Inside Refrigerator Cleaning | DEFAULT_MAID_SERVICE_0 |  | $0.00 |  |  |  |  |  | Detailed interior refrigerator cleaning, including wiping and sanitizing shelves, drawers, and door seals to remove buildup, spills, and odors. |
| Add-On Services | Interior Cabinet Cleaning | DEFAULT_MAID_SERVICE_1 |  | $0.00 | $100 | $150 | $230 |  |  | Clean inside cabinets and drawers (kitchen/bath), including wipe-down and light degrease. |
| Add-On Services | Additional Rooms Sanitization (Baths/Bedrooms) | DEFAULT_MAID_SERVICE_2 |  | $0.00 | $30 | $40 | $60 |  |  | Clean and sanitize additional bathrooms and bedrooms, including sinks, toilets, tubs/showers, surfaces, and floors as applicable. |
| Add-On Services | Post-Construction Cleaning | DEFAULT_MAID_SERVICE_3 |  | $0.00 | $162 | $395 | $895 |  |  | Remove construction dust from surfaces, fixtures, and floors, including detailed wipe-down and vacuum/mop of the cleaned areas. |
| Add-On Services | Inside Oven Cleaning | DEFAULT_MAID_SERVICE_4 |  | $0.00 | $35 | $50 | $100 |  |  | Degrease and detail clean oven interior and racks (as accessible). |
| Add-On Services | Deep Clean & Sanitize (Key Areas) | DEFAULT_MAID_SERVICE_5 |  | $0.00 | $122 | $220 | $312 |  |  | Detailed cleaning and sanitizing of kitchens and bathrooms, including sinks, toilets, tubs/showers, counters, fixtures, and high-touch surfaces. |
| Book Now | One-Time Deep Cleaning | DEFAULT_MAID_SERVICE_6 |  | $0.00 |  |  |  | 120 | yes | Detailed whole-home cleaning service. |
| Book Now | Recurring Cleaning Service | DEFAULT_MAID_SERVICE_7 |  | $0.00 |  |  |  | 120 | yes | Weekly, bi-weekly, or monthly cleaning. |
| Book Now | Move-In / Move-Out Cleaning | DEFAULT_MAID_SERVICE_8 |  | $0.00 |  |  |  | 120 | yes | Comprehensive cleaning before or after a move. |
| Commercial Cleaning | Recurring - Office / Commercial Cleaning | DEFAULT_MAID_SERVICE_9 |  | $0.00 |  |  |  |  |  | Scheduled cleaning service for office or commercial spaces, maintaining cleanliness of floors, restrooms, work areas, and shared surfaces to support a healthy and professional environment. |
| Commercial Cleaning | Recurring Commercial Cleaning (Weekly/Bi-Weekly) | DEFAULT_MAID_SERVICE_10 |  | $0.00 |  |  |  |  |  | Routine commercial cleaning on a weekly or bi-weekly schedule, including floor care, restroom sanitation, trash removal, and high-touch surface cleaning. |
| Commercial Cleaning | Weekly Janitorial Service (Commercial) | DEFAULT_MAID_SERVICE_11 |  | $0.00 |  |  |  |  |  | Comprehensive weekly janitorial service for commercial spaces, focusing on consistent upkeep of restrooms, floors, trash, and common areas. |
| Commercial Cleaning | One-Time - Office / Commercial Cleaning | DEFAULT_MAID_SERVICE_12 |  | $0.00 |  |  |  |  |  | One-time professional cleaning service for office or commercial spaces, addressing key areas to restore cleanliness and maintain a presentable environment. |
| Core Home Cleaning | Home Cleaning (Hourly - 2 Cleaners, 2-Hour Minimum) | DEFAULT_MAID_SERVICE_13 |  | $0.00 |  |  |  |  |  | Professional home cleaning billed hourly with a two-cleaner team and minimum service time, covering essential tasks like dusting, vacuuming, mopping, and kitchen and bathroom sanitization for a thorough and efficient clean. |
| Core Home Cleaning | Routine Home Cleaning (General) | DEFAULT_MAID_SERVICE_14 |  | $0.00 |  |  |  |  |  | Standard residential cleaning service focused on maintaining cleanliness of key living areas, including dusting, vacuuming, mopping, and surface wipe-downs. |
| Core Home Cleaning | One-Time Cleaning - Studio | DEFAULT_MAID_SERVICE_15 |  | $0.00 |  |  |  |  |  | One-time professional cleaning service for a studio unit, covering essential tasks to restore cleanliness and comfort. |
| Core Home Cleaning | Apartment Cleaning (1 Bed / 1 Bath) | DEFAULT_MAID_SERVICE_16 |  | $0.00 | $120 | $150 | $195 |  |  | Thorough cleaning of one-bedroom, one-bathroom apartments across multiple units, including kitchen, bathroom, living area, and floors. |
| Core Home Cleaning | One-Time Cleaning - 1 Bedroom, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_17 |  | $0.00 |  |  |  |  |  | One-time professional cleaning service for a one-bedroom home, covering essential areas to restore cleanliness and comfort. |
| Core Home Cleaning | One-Time Cleaning - 2 Bedrooms, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_18 |  | $0.00 |  |  |  |  |  | One-time professional cleaning service for a two-bedroom home, covering essential areas to restore cleanliness and comfort. |
| Core Home Cleaning | One-Time Cleaning - 3 Bedrooms, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_19 |  | $0.00 |  |  |  |  |  | One-time professional cleaning service for a three-bedroom home, covering essential areas to restore cleanliness and comfort. |
| Core Home Cleaning | One-Time Cleaning - 4 Bedrooms, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_20 |  | $0.00 |  |  |  |  |  | One-time professional cleaning service for a four-bedroom home, covering essential areas to restore cleanliness and comfort. |
| Core Home Cleaning | One-Time Cleaning - 5+ Bedrooms, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_21 |  | $0.00 |  |  |  |  |  | One-time professional cleaning service for a large home with five or more bedrooms, covering essential areas to restore cleanliness and comfort. |
| Move-In / Move-Out Cleaning | Move In/Out Cleaning - Studio | DEFAULT_MAID_SERVICE_22 |  | $0.00 |  |  |  |  |  | Thorough cleaning service for studio units during move-in or move-out, ensuring all surfaces are cleaned, sanitized, and ready for occupancy. |
| Move-In / Move-Out Cleaning | Move In/Out Cleaning - 1 Bedroom, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_23 |  | $0.00 |  |  |  |  |  | Detailed cleaning for one-bedroom homes during move transitions, covering bathrooms, kitchen, and living areas to prepare the space for new occupants. |
| Move-In / Move-Out Cleaning | Move In/Out Cleaning - 2 Bedrooms, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_24 |  | $0.00 |  |  |  |  |  | Comprehensive move-in or move-out cleaning for two-bedroom homes, addressing all major surfaces and high-use areas for a fresh start. |
| Move-In / Move-Out Cleaning | Move In/Out Cleaning - 2 Bedrooms, 1 Bathroom | DEFAULT_MAID_SERVICE_25 |  | $0.00 |  |  |  |  |  | Full cleaning service for a two-bedroom, one-bathroom home during move transitions, ensuring a clean and ready-to-use space. |
| Move-In / Move-Out Cleaning | Move In/Out Cleaning - 3 Bedrooms, 1 Bathroom | DEFAULT_MAID_SERVICE_26 |  | $0.00 |  |  |  |  |  | Deep cleaning service for three-bedroom homes during move-in or move-out, focusing on restoring cleanliness across all living areas. |
| Move-In / Move-Out Cleaning | Move In/Out Cleaning - 4 Bedrooms, 1 Bathroom | DEFAULT_MAID_SERVICE_27 |  | $0.00 |  |  |  |  |  | Move-in or move-out cleaning for larger homes, delivering a detailed clean across bedrooms, kitchen, bathrooms, and common spaces. |
| Move-In / Move-Out Cleaning | Move In/Out Cleaning - 5+ Bedrooms, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_28 |  | $0.00 |  |  |  |  |  | Extensive cleaning service for large homes during move transitions, ensuring all areas are cleaned, sanitized, and ready for occupancy. |
| Move-In / Move-Out Cleaning | Move In/Out Cleaning - 3 Bedrooms, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_29 |  | $0.00 |  |  |  |  |  | Deep cleaning service for three-bedroom homes with 2-5 bathrooms during move-in or move-out, focusing on restoring cleanliness across all living areas. |
| Move-In / Move-Out Cleaning | Move In/Out Cleaning - 4 Bedrooms, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_30 |  | $0.00 |  |  |  |  |  | Move-in or move-out cleaning for four-bedroom homes with 2-5 bathrooms, delivering a detailed clean across bedrooms, kitchen, bathrooms, and common spaces. |
| Recurring Cleaning | Recurring - 1 Bedroom, 1 Bathroom | DEFAULT_MAID_SERVICE_31 |  | $0.00 |  |  |  |  |  | Scheduled home cleaning for a one-bedroom, one-bathroom space, maintaining cleanliness through routine dusting, vacuuming, mopping, and surface sanitization. |
| Recurring Cleaning | Recurring - 1 Bedroom, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_32 |  | $0.00 |  |  |  |  |  | Routine cleaning service for a one-bedroom home with multiple bathrooms, focusing on consistent upkeep of living areas and sanitation of high-use spaces. |
| Recurring Cleaning | Recurring - 4 Bedrooms, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_33 |  | $0.00 |  |  |  |  |  | Recurring cleaning service for larger homes, covering bedrooms, bathrooms, kitchen, and common areas to maintain cleanliness and reduce buildup over time. |
| Recurring Cleaning | Recurring - 5+ Bedrooms, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_34 |  | $0.00 |  |  |  |  |  | Ongoing cleaning service for large homes with multiple bedrooms and bathrooms, ensuring consistent maintenance and improved overall home hygiene. |
| Recurring Cleaning | Recurring - Kitchen / Restroom Cleaning | DEFAULT_MAID_SERVICE_35 |  | $0.00 |  |  |  |  |  | Targeted recurring cleaning for kitchens and restrooms, focusing on sanitation, grease removal, and high-touch surface cleaning. |
| Recurring Cleaning | Recurring Home Cleaning (Bi-Weekly) | DEFAULT_MAID_SERVICE_36 |  | $0.00 | $150 | $178 | $220 |  |  | Bi-weekly interior home cleaning for ongoing upkeep of common areas, bedrooms, bathrooms, and floors. |
| Recurring Cleaning | Recurring - 3 Bedrooms, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_37 |  | $0.00 |  |  |  |  |  | Recurring cleaning service for a three-bedroom home, covering bedrooms, bathrooms, kitchen, and common areas to maintain cleanliness over time. |
| Recurring Cleaning | Recurring - 2 Bedrooms, 2–5 Bathrooms | DEFAULT_MAID_SERVICE_38 |  | $0.00 |  |  |  |  |  | Recurring cleaning service for a two-bedroom home, covering bedrooms, bathrooms, kitchen, and common areas to maintain cleanliness over time. |

## Plumbing

- Services: **90** (90 with a task code, 0 without) in **11** categories (` > ` = nested subcategory): Book Now, Dishwasher & Garbage Disposal, Drain Cleaning, Faucet, Laundry - Washer & Dryer, Repair Services, Sewer Pump Replacement, Toilet, Tub & Shower, Valves & Water Regulation, Water Heater - Replacements
- Pricing insight available for 90 of 90 services; median of medians **$325**
- Industry card image seeded: yes (stock photo)

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Book Now | Water Heater Repair | DEFAULT_PLUMBING_SERVICE_0 |  | $0.00 | $135 | $350 | $987 | 120 | yes | Need help with your water heater? / Repair malfunctioning heater / Replace old water heater / Install new water heater / Other water heater issues / Our skilled plumbers ensure you have hot water when you need it by providing top-notch repair, replacement, and installation services. Book our Water Heater service today for reliable hot water solutions! |
| Book Now | Leak Detection Repair | DEFAULT_PLUMBING_SERVICE_1 |  | $0.00 | $250 | $325 | $450 | 120 | yes | Experiencing leaks in your home? / Dripping faucets / Leaking pipes / Running toilets / Other water leak issues / Our expert plumbers specialize in detecting and repairing all types of leaks to prevent water damage and save you money. Book our Leak Detection and Repair service today for quick and reliable solutions! |
| Book Now | Drain Cleaning | DEFAULT_PLUMBING_SERVICE_2 |  | $0.00 | $158 | $250 | $325 | 120 | yes | Having trouble with slow or clogged drains? / Slow draining sinks / Clogged toilets / Blocked shower drains / Other drain issues / Our professional plumbers use the latest tools and techniques to clear your drains efficiently. Book our Drain Cleaning service today and enjoy free-flowing drains again! |
| Dishwasher & Garbage Disposal | Replace Dishwasher Tailpiece | DEFAULT_PLUMBING_SERVICE_3 |  | $0.00 | $173 | $275 | $427 |  |  | Upgrade your dishwasher's drain connection with our brass tailpiece replacement service. If your existing tailpiece is damaged or leaking, our technicians will replace it with a new brass threaded or flanged tailpiece, ensuring a secure and reliable connection for your dishwasher. |
| Dishwasher & Garbage Disposal | Remove Garbage Disposal & Install Strainer | DEFAULT_PLUMBING_SERVICE_4 |  | $0.00 | $270 | $385 | $558 |  |  | Upgrade your kitchen plumbing with our garbage disposal removal and replacement service. We'll remove your old disposal unit and install a new strainer and tailpiece, connecting them to your existing plumbing trap for a seamless and leak-free setup. |
| Dishwasher & Garbage Disposal | Replace Dishwasher Trap & Tailpiece | DEFAULT_PLUMBING_SERVICE_5 |  | $0.00 | $185 | $280 | $430 |  |  | Keep your dishwasher draining smoothly with our trap and tailpiece replacement service. We'll replace the trap (P-trap) and tailpiece to ensure proper drainage and secure connections, preventing leaks and maintaining your kitchen's functionality. |
| Dishwasher & Garbage Disposal | Install Dishwasher Flex Line & Leak Test | DEFAULT_PLUMBING_SERVICE_6 |  | $0.00 | $175 | $250 | $300 |  |  | Ensure your dishwasher operates efficiently with our stainless steel flex line installation service. We'll connect your dishwasher to the water supply with a durable flex line and perform a thorough leak test to guarantee no leaks at the connections, giving you peace of mind. |
| Drain Cleaning | Septic Tank Pumping | DEFAULT_PLUMBING_SERVICE_7 |  | $0.00 | $295 | $375 | $485 |  |  | Pumping out the septic tank up to 1000 gallons |
| Drain Cleaning | Cable Drain Cleaning | DEFAULT_PLUMBING_SERVICE_8 |  | $0.00 | $198 | $275 | $387 |  |  | Cable drain cleaning involves using a cable to unclog and clear blocked drain lines |
| Drain Cleaning | Grease Trap Service | DEFAULT_PLUMBING_SERVICE_9 |  | $0.00 | $193 | $300 | $525 |  |  | Perform grease trap service including pump out and pressure cleaning of interceptors |
| Drain Cleaning | Clean Ice Machine | DEFAULT_PLUMBING_SERVICE_10 |  | $0.00 | $159 | $293 | $546 |  |  | Clean the ice machine to ensure proper operation and hygiene |
| Drain Cleaning | Clean Main Line | DEFAULT_PLUMBING_SERVICE_11 |  | $0.00 | $185 | $286 | $400 |  |  | Clean the main line to remove blockages |
| Drain Cleaning | Clean Drain | DEFAULT_PLUMBING_SERVICE_12 |  | $0.00 | $125 | $180 | $275 |  |  | Clean the drain to ensure proper flow |
| Drain Cleaning | Clear Kitchen Sink Line | DEFAULT_PLUMBING_SERVICE_13 |  | $0.00 | $150 | $203 | $300 |  |  | The kitchen sink line was cleared of blockages using a cable |
| Drain Cleaning | Hydro Jetting Service | DEFAULT_PLUMBING_SERVICE_14 |  | $0.00 | $540 | $800 | $1,250 |  |  | Perform hydro jetting to clean out drain lines |
| Drain Cleaning | Tub or Shower Drain Clearing with Manual Tool | DEFAULT_PLUMBING_SERVICE_15 |  | $0.00 | $150 | $225 | $300 |  |  | Enjoy a hassle-free shower or bath with our tub or shower drain clearing service. Using manual tools like a drain snake or auger, we effectively clear blockages, ensuring your drains work smoothly. |
| Drain Cleaning | Main Drain Clearing with Large Drum Equipment | DEFAULT_PLUMBING_SERVICE_16 |  | $0.00 | $225 | $347 | $450 |  |  | Ensure your plumbing system runs smoothly with our main drain clearing service. Using large drum equipment, we can handle heavy-duty clearing tasks, removing blockages and restoring proper flow. |
| Drain Cleaning | Sink Drain Clearing with Electric Jetting | DEFAULT_PLUMBING_SERVICE_17 |  | $0.00 | $300 | $495 | $840 |  |  | Say goodbye to sink drain clogs with our electric jetting service. Our high-pressure water jetting equipment breaks up clogs and cleans the drain, restoring optimal flow and preventing future blockages. |
| Drain Cleaning | Toilet Clearing with Auger Tool | DEFAULT_PLUMBING_SERVICE_18 |  | $0.00 | $148 | $198 | $275 |  |  | Don't let a clogged toilet disrupt your day. Our toilet clearing service uses an auger tool, specifically designed for toilet drains, to quickly and effectively remove blockages, restoring proper function. |
| Drain Cleaning | Drain Inspection with Camera | DEFAULT_PLUMBING_SERVICE_19 |  | $0.00 | $225 | $319 | $411 |  |  | Ensure your plumbing system is in top condition with our drain inspection service. Using a specialized camera, we can identify blockages, leaks, or other issues within your drain lines, allowing for targeted repairs and maintenance. |
| Drain Cleaning | Branch Drain Clearing with Small Drum Equipment | DEFAULT_PLUMBING_SERVICE_20 |  | $0.00 | $200 | $276 | $360 |  |  | Keep your plumbing lines clear with our branch drain clearing service. Using smaller, more maneuverable drum equipment, we target blockages in branch drain lines, ensuring your system operates efficiently. |
| Drain Cleaning | Main Drain Treatment with Root Growth Preventer | DEFAULT_PLUMBING_SERVICE_21 |  | $0.00 | $200 | $298 | $475 |  |  | Protect your plumbing system from future blockages with our main drain treatment service. We use a root growth preventer to inhibit the growth of roots in your main drain line, preventing costly and inconvenient blockages in the future. |
| Faucet | Replace 2 Handle Faucet | DEFAULT_PLUMBING_SERVICE_22 |  | $0.00 | $259 | $420 | $695 |  |  | Modernize your faucet with our two-handle faucet replacement service. We'll replace your faucet with separate handles for hot and cold water, giving you precise control over water temperature and flow, enhancing the functionality and style of your kitchen or bathroom. |
| Faucet | Replace Washers/Seats | DEFAULT_PLUMBING_SERVICE_23 |  | $0.00 | $150 | $250 | $397 |  |  | Improve your faucet's functionality with our washer and seat replacement service. We'll replace the washers and/or seats, which create a watertight seal when the faucet is closed, preventing leaks and ensuring smooth operation. |
| Faucet | Replace Lavatory Faucet Aerator | DEFAULT_PLUMBING_SERVICE_24 |  | $0.00 | $145 | $275 | $484 |  |  | Enhance your bathroom faucet's performance with our aerator replacement service. We'll replace the aerator, the small device at the end of the faucet spout that mixes air with water to reduce splashing and save water, ensuring smooth and efficient water flow. |
| Faucet | Replace Single Lever Faucet | DEFAULT_PLUMBING_SERVICE_25 |  | $0.00 | $279 | $465 | $799 |  |  | Upgrade your faucet with our single lever faucet replacement service. We'll replace your existing single lever faucet, which controls both flow rate and temperature with a single handle, providing you with a new, reliable faucet for your kitchen or bathroom. |
| Laundry - Washer & Dryer | Install Appliance with Customer's Parts | DEFAULT_PLUMBING_SERVICE_26 |  | $0.00 | $200 | $284 | $385 |  |  | Have your own parts for your appliance installation? No problem! Our installation service allows you to provide the parts, and we'll take care of the rest, ensuring your appliance is installed correctly and ready to use. |
| Laundry - Washer & Dryer | Disconnect and Reinstall Dryer with Existing Parts | DEFAULT_PLUMBING_SERVICE_27 |  | $0.00 | $185 | $350 | $614 |  |  | Keep your dryer working efficiently with our disconnect and reinstall service. We'll disconnect your dryer and reinstall it using its existing parts, ensuring it's properly positioned and ready for use. |
| Laundry - Washer & Dryer | Replace Dryer Vent Hood Through Wall | DEFAULT_PLUMBING_SERVICE_28 |  | $0.00 | $334 | $600 | $1,123 |  |  | Improve your home's safety with our dryer vent hood replacement service. We'll replace the existing vent hood for your dryer, ensuring it's properly installed and vented through the wall, reducing the risk of fire hazard. |
| Laundry - Washer & Dryer | Clean Dryer Vent | DEFAULT_PLUMBING_SERVICE_29 |  | $0.00 | $175 | $200 | $257 |  |  | Ensure your dryer operates safely and efficiently with our dryer vent cleaning service. We'll remove lint and debris from the vent, improving airflow and reducing the risk of fire hazard, keeping your home safe and your dryer performing at its best. |
| Laundry - Washer & Dryer | Replace or Install Appliance Stainless Steel Flex Line & Leak Test | DEFAULT_PLUMBING_SERVICE_30 |  | $0.00 | $145 | $250 | $400 |  |  | Upgrade your appliance's water supply with our stainless steel flex line replacement or installation service. We'll replace or install a durable flex line and perform a leak test to ensure a tight connection, giving you confidence in your appliance's performance. |
| Laundry - Washer & Dryer | Disconnect and Reinstall Appliance with Existing Parts | DEFAULT_PLUMBING_SERVICE_31 |  | $0.00 | $205 | $345 | $600 |  |  | Need to move or reposition your appliance? Our disconnect and reinstall service is perfect for you. We'll carefully disconnect your appliance, such as a washer or dryer, and reinstall it using its existing parts, ensuring a seamless transition. |
| Laundry - Washer & Dryer | Replace or Install Appliance Drain Hose & Leak Test | DEFAULT_PLUMBING_SERVICE_32 |  | $0.00 | $188 | $290 | $471 |  |  | Keep your appliances running smoothly with our drain hose replacement or installation service. Whether it's for a washer or dryer, we'll replace or install a new drain hose and conduct a thorough leak test to ensure a secure connection and prevent leaks. |
| Repair Services | Repair Toilet | DEFAULT_PLUMBING_SERVICE_33 |  | $0.00 | $68 | $185 | $337 |  |  | Repair toilets by replacing damaged components and ensuring proper operation |
| Repair Services | Install Kitchen Sink | DEFAULT_PLUMBING_SERVICE_34 |  | $0.00 | $120 | $255 | $585 |  |  | Install kitchen sink and related fixtures |
| Repair Services | Install Shower Faucet | DEFAULT_PLUMBING_SERVICE_35 |  | $0.00 | $250 | $447 | $887 |  |  | Install new shower faucets and fixtures |
| Repair Services | Shower Cartridge Replacement | DEFAULT_PLUMBING_SERVICE_36 |  | $0.00 | $225 | $325 | $450 |  |  | Replace the shower cartridge to resolve issues such as dripping or leaking |
| Repair Services | Flapper Parts Replacement | DEFAULT_PLUMBING_SERVICE_37 |  | $0.00 | $40 | $120 | $200 |  |  | Replace the flapper parts as needed |
| Repair Services | Install Kitchen Faucet | DEFAULT_PLUMBING_SERVICE_38 |  | $0.00 | $225 | $325 | $525 |  |  | Install customer provided kitchen faucet |
| Repair Services | Toilet Valve Replacement | DEFAULT_PLUMBING_SERVICE_39 |  | $0.00 | $155 | $259 | $478 |  |  | Replace the toilet valve in various bathrooms |
| Repair Services | Shower Valve Install | DEFAULT_PLUMBING_SERVICE_40 |  | $0.00 | $475 | $975 | $1,900 |  |  | Install new shower valves and associated trim in various bathroom configurations |
| Repair Services | Toilet Install | DEFAULT_PLUMBING_SERVICE_41 |  | $0.00 | $275 | $450 | $789 |  |  | Install a new toilet including necessary components and removal of the old unit |
| Repair Services | Replaced Tub Spout | DEFAULT_PLUMBING_SERVICE_42 |  | $0.00 | $149 | $229 | $355 |  |  | Replaced the tub spout in various bathrooms due to leaks or damage |
| Repair Services | Diagnostic (Commercial) | DEFAULT_PLUMBING_SERVICE_43 |  | $0.00 | $120 | $149 | $200 |  |  | For businesses and commercial properties, our commercial diagnostic service can pinpoint plumbing issues and provide effective solutions to minimize downtime and ensure your operations run smoothly. |
| Repair Services | Diagnostic (Out-of-Range) | DEFAULT_PLUMBING_SERVICE_44 |  | $0.00 | $99 | $100 | $150 |  |  | Even if you're located outside our usual service area, our out-of-range diagnostic service can help. We'll diagnose your plumbing issues and provide recommendations for repairs, no matter where you are. |
| Repair Services | Diagnostic (Weekend) | DEFAULT_PLUMBING_SERVICE_45 |  | $0.00 | $75 | $95 | $149 |  |  | Weekend plumbing problems? Our weekend diagnostic service is here for you. Our expert plumbers will diagnose your plumbing issues and develop a plan for repairs, so you can enjoy your weekend worry-free. |
| Repair Services | Diagnostic (Emergency) | DEFAULT_PLUMBING_SERVICE_46 |  | $0.00 | $150 | $199 | $259 |  |  | Plumbing problems can't always wait for business hours. Our emergency diagnostic service is available outside of regular hours to address urgent issues promptly, preventing further damage and ensuring your safety. |
| Repair Services | Diagnostic (Residential) | DEFAULT_PLUMBING_SERVICE_47 |  | $0.00 | $79 | $99 | $175 |  |  | Is your home experiencing plumbing issues? Our residential diagnostic service can identify and troubleshoot problems quickly and accurately, ensuring your plumbing system is back up and running smoothly. |
| Sewer Pump Replacement | Sewer Line Replacement | DEFAULT_PLUMBING_SERVICE_48 |  | $0.00 | $350 | $1,200 | $5,178 |  |  | Replace damaged sewer lines with new piping |
| Sewer Pump Replacement | Water Line Install | DEFAULT_PLUMBING_SERVICE_49 |  | $0.00 | $501 | $1,450 | $4,500 |  |  | Install new water lines or replace existing ones with copper or pex materials |
| Sewer Pump Replacement | Sewer Line Install | DEFAULT_PLUMBING_SERVICE_50 |  | $0.00 | $535 | $2,342 | $5,760 |  |  | Install new sewer lines and cleanouts as part of the repair process |
| Sewer Pump Replacement | Leak Repair Service | DEFAULT_PLUMBING_SERVICE_51 |  | $0.00 | $89 | $180 | $330 |  |  | Repairing  plumbing leaks and clogs |
| Sewer Pump Replacement | Gas Line Installation | DEFAULT_PLUMBING_SERVICE_52 |  | $0.00 | $375 | $975 | $2,250 |  |  | Install new gas lines for various appliances |
| Sewer Pump Replacement | Main Water Line Replacement | DEFAULT_PLUMBING_SERVICE_53 |  | $0.00 | $550 | $2,000 | $5,000 |  |  | Replace the main water line from the city meter to the home |
| Sewer Pump Replacement | Water Line Repair | DEFAULT_PLUMBING_SERVICE_54 |  | $0.00 | $166 | $336 | $619 |  |  | Repairing leaks in various water lines to ensure proper functionality |
| Sewer Pump Replacement | Replace and Test Mercury Float Switch | DEFAULT_PLUMBING_SERVICE_55 |  | $0.00 | $275 | $494 | $789 |  |  | Ensure your sump pump operates reliably with our mercury float switch replacement service. We'll replace the switch responsible for detecting water levels in the sump pit and activating the pump when needed. After replacement, we'll test the switch to ensure it functions properly, keeping your basement dry and protected. |
| Sewer Pump Replacement | Repair Sump Pump Discharge Line and Test | DEFAULT_PLUMBING_SERVICE_56 |  | $0.00 | $100 | $310 | $876 |  |  | Maintain proper drainage from your sump pump with our discharge line repair service. We'll repair any damage or blockages in the discharge line, which carries water from the pump to the outside of the building. After repair, we'll test the line to ensure it functions correctly, preventing water buildup and potential flooding. |
| Sewer Pump Replacement | Install Battery Back-Up Sump Pump Unit NOT Included | DEFAULT_PLUMBING_SERVICE_57 |  | $0.00 | $1,575 | $2,321 | $2,856 |  |  | Protect your basement from flooding during power outages with our battery backup sump pump installation service. We'll install a battery backup system for your sump pump, ensuring it continues to operate even when the power is out. Please note, this service does not include the cost of the battery backup unit itself. |
| Sewer Pump Replacement | Replace Sump Pump Water Check Valve (Up to 1 - 1/2 Inch | DEFAULT_PLUMBING_SERVICE_58 |  | $0.00 | $475 | $750 | $1,250 |  |  | Upgrade your sump pump system with our check valve replacement service. We'll replace the water check valve, which prevents water in the discharge line from flowing back into the sump pit after the pump shuts off. Ensure your sump pump operates efficiently and prevents water backup with this essential replacement. |
| Sewer Pump Replacement | Replace Sump Pump - Customer Provided | DEFAULT_PLUMBING_SERVICE_59 |  | $0.00 | $528 | $796 | $1,368 |  |  | Upgrade your sump pump with our replacement service. We'll remove your old or malfunctioning sump pump and install a new one, with you providing the new pump. Ensure your basement stays dry and protected from flooding with this essential service. |
| Toilet | Toilet Tank Replacement | DEFAULT_PLUMBING_SERVICE_60 |  | $0.00 | $225 | $410 | $750 |  |  | Upgrade your toilet with our tank replacement service. If your old tank is damaged or worn, our technicians will remove it and install a new one, ensuring your toilet operates smoothly and efficiently, giving your bathroom a fresh look and functionality. |
| Toilet | Flapper Replacement and Testing | DEFAULT_PLUMBING_SERVICE_61 |  | $0.00 | $125 | $180 | $265 |  |  | Keep your toilet functioning smoothly with our flapper replacement and testing service. We'll replace the rubber flapper valve that controls water flow from the tank to the bowl and test it to ensure it operates properly, preventing water waste and ensuring efficient flushing. |
| Toilet | Tank Fill Valve Replacement and Testing | DEFAULT_PLUMBING_SERVICE_62 |  | $0.00 | $160 | $225 | $332 |  |  | Maintain optimal water levels in your toilet tank with our fill valve replacement and testing service. We'll replace the fill valve, which regulates the water level, and test it to ensure it functions correctly, preventing overflows and water waste. |
| Toilet | Toilet Tank Rebuilding - Flapper & Fill Valve Only | DEFAULT_PLUMBING_SERVICE_63 |  | $0.00 | $199 | $281 | $380 |  |  | Improve your toilet's performance with our tank rebuilding service. We'll focus on the essential components inside the tank, replacing the flapper and fill valve to restore efficient flushing without the need to replace the entire tank, saving you time and money. |
| Toilet | Toilet Reset and Seal | DEFAULT_PLUMBING_SERVICE_64 |  | $0.00 | $225 | $301 | $430 |  |  | Ensure your toilet is leak-free with our toilet reset and seal service. We'll carefully reset the toilet onto the floor and replace the wax ring seal, guaranteeing a watertight connection between the toilet and the drain pipe, preventing leaks and water damage. |
| Toilet | Sweat Valve | DEFAULT_PLUMBING_SERVICE_65 |  | $0.00 | $250 | $409 | $833 |  |  | Upgrade your plumbing system with our sweat valve installation or replacement service. A sweat valve is soldered onto a pipe, providing a secure and durable connection. Our technicians will expertly install or replace a sweat valve, ensuring your plumbing operates smoothly and efficiently. |
| Tub & Shower | Replace Shower Base No Tile Removal or Replacement | DEFAULT_PLUMBING_SERVICE_66 |  | $0.00 | $439 | $760 | $1,875 |  |  | Upgrade your shower without the hassle of tile removal or replacement. Our shower base replacement service allows for the installation of a new base without disturbing your existing tiles, saving you time and money. |
| Tub & Shower | Replace Pop Up Drain | DEFAULT_PLUMBING_SERVICE_67 |  | $0.00 | $176 | $275 | $395 |  |  | Improve the functionality of your sink or bathtub with our pop-up drain replacement service. We'll replace the pop-up drain assembly, including the drain stopper mechanism, ensuring smooth drainage and preventing clogs. |
| Tub & Shower | Replace Shower Base | DEFAULT_PLUMBING_SERVICE_68 |  | $0.00 | $424 | $850 | $2,250 |  |  | Transform your shower with our shower base replacement service. We'll remove the old shower base and install a new one, providing a waterproof floor that collects and drains water, enhancing the functionality and aesthetics of your shower. |
| Tub & Shower | Replace Tub Waste & Overflow | DEFAULT_PLUMBING_SERVICE_69 |  | $0.00 | $425 | $735 | $1,200 |  |  | Upgrade your bathtub with our tub waste and overflow replacement service. We'll replace the drain and overflow system, including the visible drain cover and piping, ensuring your bathtub drains efficiently and looks great. |
| Valves & Water Regulation | Main Valve Replacement | DEFAULT_PLUMBING_SERVICE_70 |  | $0.00 | $235 | $397 | $650 |  |  | Replace the existing main valve with a new one |
| Valves & Water Regulation | Install Gas Valve | DEFAULT_PLUMBING_SERVICE_71 |  | $0.00 | $200 | $350 | $595 |  |  | Install a gas valve for proper functionality |
| Valves & Water Regulation | Install Water Softener System | DEFAULT_PLUMBING_SERVICE_72 |  | $0.00 | $990 | $2,203 | $3,540 |  |  | Installation of a water softener system to improve water quality in the home |
| Valves & Water Regulation | Install Water Valve | DEFAULT_PLUMBING_SERVICE_73 |  | $0.00 | $245 | $430 | $807 |  |  | Install a water valve for plumbing needs |
| Valves & Water Regulation | Water Purification Services | DEFAULT_PLUMBING_SERVICE_74 |  | $0.00 | $85 | $110 | $300 |  |  | Installation and maintenance of purified and distilled water systems for various facilities. |
| Valves & Water Regulation | Angle Stop Replacement | DEFAULT_PLUMBING_SERVICE_75 |  | $0.00 | $180 | $290 | $495 |  |  | Replace angle stop and supply line for faucet or toilet |
| Valves & Water Regulation | Hose Bib Replacement | DEFAULT_PLUMBING_SERVICE_76 |  | $0.00 | $200 | $325 | $499 |  |  | Replace old hose bibs with new ones |
| Valves & Water Regulation | Pressure Reducing Valve Install | DEFAULT_PLUMBING_SERVICE_77 |  | $0.00 | $475 | $700 | $1,000 |  |  | Install a new pressure reducing valve to regulate water pressure in the home |
| Water Heater - Replacements | Install And Service Gas Water Heater | DEFAULT_PLUMBING_SERVICE_78 |  | $0.00 | $175 | $450 | $1,250 |  |  | Supply, install, and service gas water heaters, including labor and necessary materials. |
| Water Heater - Replacements | Install New Water Heater (>50 Gallons Electric)) | DEFAULT_PLUMBING_SERVICE_79 |  | $0.00 | $1,700 | $2,250 | $2,880 |  |  | Install a new 50 gallon electric water heater with necessary components and warranties |
| Water Heater - Replacements | Tankless Water Heater Installation | DEFAULT_PLUMBING_SERVICE_80 |  | $0.00 | $768 | $3,600 | $5,800 |  |  | Install a new tankless water heater with necessary components and warranties |
| Water Heater - Replacements | Water Heater Install (Generic) | DEFAULT_PLUMBING_SERVICE_81 |  | $0.00 | $300 | $718 | $1,875 |  |  | Install new water heaters including necessary components and warranties |
| Water Heater - Replacements | Replace Emergency Shutoff Valve | DEFAULT_PLUMBING_SERVICE_82 |  | $0.00 | $244 | $350 | $575 |  |  | Improve safety with our emergency shutoff valve replacement service. We'll replace the emergency shutoff valve, which is used to quickly shut off the water supply in case of a leak or other emergency, ensuring your water heater remains safe and reliable. |
| Water Heater - Replacements | Replace Thermostat | DEFAULT_PLUMBING_SERVICE_83 |  | $0.00 | $250 | $425 | $800 |  |  | Ensure your water heater operates efficiently with our thermostat replacement service. We'll replace the thermostat, which controls the water temperature, ensuring your water heater functions optimally and provides reliable hot water. |
| Water Heater - Replacements | Replace Valve Drain Line | DEFAULT_PLUMBING_SERVICE_84 |  | $0.00 | $207 | $350 | $660 |  |  | Ensure your water heater remains easy to maintain with our valve drain line replacement service. We'll replace the drain line valve, which is used to drain the tank for maintenance or repairs, keeping your water heater accessible for service. |
| Water Heater - Replacements | Service Water Heater Burners | DEFAULT_PLUMBING_SERVICE_85 |  | $0.00 | $175 | $254 | $350 |  |  | Maintain your water heater's efficiency with our burner service. We'll clean, adjust, or replace the burners to ensure they function properly and efficiently, keeping your water heater running smoothly. |
| Water Heater - Replacements | Replace Expansion Tank | DEFAULT_PLUMBING_SERVICE_86 |  | $0.00 | $237 | $360 | $457 |  |  | Maintain your plumbing system's integrity with our expansion tank replacement service. We'll replace the expansion tank, which helps accommodate water expansion as it is heated, reducing pressure on the plumbing system and ensuring its longevity. |
| Water Heater - Replacements | Repair Water Leak Above Water Heater | DEFAULT_PLUMBING_SERVICE_87 |  | $0.00 | $210 | $375 | $685 |  |  | Prevent water damage with our leak repair service. We'll identify and repair any leaks in the plumbing above your water heater, ensuring your unit remains dry and functional. |
| Water Heater - Replacements | Replace Safety Sensor | DEFAULT_PLUMBING_SERVICE_88 |  | $0.00 | $189 | $360 | $583 |  |  | Keep your water heater safe with our safety sensor replacement service. We'll replace the safety sensor, which detects overheating and shuts off the heater to prevent damage or safety hazards, ensuring your water heater operates safely and reliably. |
| Water Heater - Replacements | Replace Hot Surface Pilot Igniter | DEFAULT_PLUMBING_SERVICE_89 |  | $0.00 | $151 | $285 | $538 |  |  | Restore your water heater's ignition system with our hot surface pilot igniter replacement service. We'll replace the igniter, which ignites the gas burner to heat the water, ensuring your water heater operates reliably and efficiently. |

## Electrical

- Services: **73** (69 with a task code, 4 without) in **14** categories (` > ` = nested subcategory): Appliances, Ballast Replacement, Book Now, Ceiling Fans, Circuit Breakers, Dimmer, Lighting Installation, Outdoor Lighting, Receptacle Replacement, Recessed Lighting, Smoke Detectors, Specialty Installations, Switch Replacement, Custom Services
- Pricing insight available for 62 of 73 services; median of medians **$390**

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Appliances | Install Contactor | DEFAULT_ELECTRICAL_SERVICE_0 |  | $0.00 | $200 | $400 | $1,090 |  |  | Install a contactor for electrical systems |
| Appliances | Install Pressure Switch | DEFAULT_ELECTRICAL_SERVICE_1 |  | $0.00 | $20 | $111 | $275 |  |  | Install a pressure switch for optimal performance |
| Appliances | Install dryer cord, 4 wire up to 6 ft | DEFAULT_ELECTRICAL_SERVICE_2 |  | $0.00 | $265 | $589 | $950 |  |  | Let us set up your dryer with a new 4-wire cord up to 6 ft long. This ensures a safe connection that meets the latest electrical codes, including a dedicated ground wire for added safety. We'll check the voltage and amperage to ensure your dryer runs efficiently and lasts longer. |
| Appliances | Install water softener outlet, GFCI protected, tap existing circuitry | DEFAULT_ELECTRICAL_SERVICE_3 |  | $0.00 | $260 | $425 | $849 |  |  | Install a new outlet for your water softener with built-in ground-fault protection, tapping into your existing wiring for added safety in wet areas. This ensures your water softener operates safely and reliably while meeting all electrical standards. |
| Appliances | Install dishwasher, hard wire to existing with disconnect | DEFAULT_ELECTRICAL_SERVICE_4 |  | $0.00 | $65 | $260 | $500 |  |  | We'll safely wire your dishwasher into your home's electrical system, complete with a disconnect switch for easy maintenance. This ensures your dishwasher is securely powered, meets electrical codes, and performs efficiently with the right amount of electricity. |
| Appliances | Install garbage disposal, cord connected up to 3 ft | DEFAULT_ELECTRICAL_SERVICE_5 |  | $0.00 | $190 | $260 | $525 |  |  | Enjoy a new garbage disposal with a cord up to 3 ft long for easy installation. We'll ensure it's wired correctly and safely grounded, providing reliable power for smooth operation in your kitchen. |
| Appliances | Install range cord, 4 wire, 6 ft | DEFAULT_ELECTRICAL_SERVICE_6 |  | $0.00 | $230 | $500 | $900 |  |  | Ensure your electric range is connected safely and efficiently with a new 4-wire cord up to 6 ft long. This setup includes a dedicated ground wire to protect your home and appliances. We'll make sure the voltage and amperage are just right for optimal cooking performance. |
| Appliances | Install microwave outlet, install 20A 120V circuit, up to 40 ft, accessible | DEFAULT_ELECTRICAL_SERVICE_7 |  | $0.00 | $463 | $807 | $1,380 |  |  | Get a new 20-amp, 120-volt circuit and outlet installed for your microwave, extending up to 40 ft through accessible areas. This dedicated setup prevents power overload and ensures your microwave operates reliably. We'll handle all the technical details to keep your kitchen powered safely. |
| Ballast Replacement | Replace standard height, two 8 ft bulb, electronic, 120V or 277V ballast | DEFAULT_ELECTRICAL_SERVICE_8 |  | $0.00 | $260 | $570 | $1,350 |  |  | Upgrade to a new electronic ballast for two 8 ft bulbs for improved lighting efficiency and performance. Perfect for 120V or 277V installations, ensuring brighter spaces with reduced energy consumption. |
| Ballast Replacement | Replace standard height, single 4 ft bulb, electronic, 120V or 277V ballast | DEFAULT_ELECTRICAL_SERVICE_9 |  | $0.00 | $195 | $384 | $877 |  |  | Upgrade your lighting with a new electronic ballast for a safe and efficient 4 ft bulb. This modern setup ensures reliable performance and energy savings, compatible with both 120V and 277V systems. |
| Ballast Replacement | Replace standard height, two 4 ft bulb, electronic, 120V or 277V ballast | DEFAULT_ELECTRICAL_SERVICE_10 |  | $0.00 | $225 | $405 | $885 |  |  | Enhance your room's lighting with a new electronic ballast for two 4 ft bulbs. This upgrade provides better illumination and efficiency, supporting both 120V and 277V electrical systems. |
| Ballast Replacement | Replace standard height, single 8 ft bulb, electronic, 120V or 277V ballast | DEFAULT_ELECTRICAL_SERVICE_11 |  | $0.00 | $46 | $125 | $352 |  |  | Improve your lighting with an electronic ballast for an 8 ft bulb. Enjoy enhanced brightness and energy efficiency with this upgrade, suitable for 120V or 277V setups in your home. |
| Book Now | Power Issue | DEFAULT_ELECTRICAL_SERVICE_12 |  | $0.00 | $125 | $175 | $240 | 120 | yes | Experiencing any of these electrical issues? / Whole home power outage / Partial power outage / Flickering lights / Noise/humming/buzzing / Other concerns / Our expert electricians specialize in diagnosing and resolving these common electrical problems swiftly. Ensure your home's safety and functionality by booking our Electrical Power Issue service today! |
| Book Now | Install/Repair Fixtures | DEFAULT_ELECTRICAL_SERVICE_13 |  | $0.00 | $145 | $218 | $468 | 120 | yes | Looking to install or repair fixtures? / Install new fixture / Repair existing fixture / Other services / Our expert electricians specialize in installing and repairing fixtures to enhance your home's functionality and aesthetics. Whether you need a new fixture installed, repairs to an existing fixture, or other electrical services, we're here to help. Book our Install/Repair Fixtures service today! |
| Book Now | Switch/Outlet | DEFAULT_ELECTRICAL_SERVICE_14 |  | $0.00 | $189 | $275 | $497 | 120 | yes | Need help with your switches or outlets? / Repair / Replace / Install new / Other / Our skilled electricians are ready to assist with any switch or outlet issue you may have. Whether it's repairing a faulty switch, replacing outdated outlets, installing new ones, or addressing other concerns, we ensure safe and efficient electrical solutions for your home. Book our Switch/Outlet service today! |
| Book Now | Electrical Panel | DEFAULT_ELECTRICAL_SERVICE_15 |  | $0.00 |  |  |  | 120 | yes | Dealing with electrical panel issues? / Repair tripping breaker / Repair panel / Replace existing panel / Install new panel / Other electrical panel services. / Trust our expert electricians to diagnose and resolve electrical panel issues, ensuring your home's safety and efficiency. From tripping breakers to upgrades and repairs, we offer reliable solutions. Book our Electrical Panel service today for peace of mind! |
| Ceiling Fans | Bathroom Exhaust Fan Installation | DEFAULT_ELECTRICAL_SERVICE_16 |  | $0.00 | $208 | $395 | $700 |  |  | Install customer supplied bathroom exhaust fans |
| Ceiling Fans | Furnish and install generic ball standard mount ceiling fan | DEFAULT_ELECTRICAL_SERVICE_17 |  | $0.00 | $198 | $346 | $500 |  |  | Enjoy improved air circulation with our installation of a standard mount ceiling fan. It enhances energy efficiency and provides reliable comfort year-round. |
| Ceiling Fans | Furnish and install generic ball standard mount ceiling fan and light combination | DEFAULT_ELECTRICAL_SERVICE_18 |  | $0.00 | $284 | $475 | $656 |  |  | Elevate your room's comfort with a ceiling fan and light combo installation. This upgrade combines effective air movement with enhanced lighting options for any space. |
| Ceiling Fans | Install fan control switch | DEFAULT_ELECTRICAL_SERVICE_19 |  | $0.00 | $175 | $275 | $495 |  |  | Optimize your ceiling fan's performance with a professionally installed control switch. It offers convenient speed adjustments, ensuring precise airflow and energy efficiency. |
| Ceiling Fans | Install customer supplied ceiling fan on existing box | DEFAULT_ELECTRICAL_SERVICE_20 |  | $0.00 | $200 | $325 | $550 |  |  | We'll expertly mount your provided ceiling fan onto your existing box, ensuring optimal functionality and airflow in your space. |
| Ceiling Fans | Install customer supplied ceiling fan with light on existing box | DEFAULT_ELECTRICAL_SERVICE_21 |  | $0.00 | $225 | $414 | $750 |  |  | Upgrade your room with a ceiling fan and light combo on the existing box. Our precise installation guarantees efficient air circulation and enhanced lighting. |
| Circuit Breakers | Install Whole House Surge Protector | DEFAULT_ELECTRICAL_SERVICE_22 |  | $0.00 | $399 | $562 | $747 |  |  | Install a whole house surge protector to safeguard your home's electrical systems from surges |
| Circuit Breakers | Replace Faulty Breakers | DEFAULT_ELECTRICAL_SERVICE_23 |  | $0.00 | $195 | $367 | $915 |  |  | Replace faulty breakers to restore power and ensure proper operation |
| Circuit Breakers | Install Circuit Breakers | DEFAULT_ELECTRICAL_SERVICE_24 |  | $0.00 | $165 | $325 | $771 |  |  | Install circuit breakers for electrical systems |
| Circuit Breakers | Install Mc Cable Connectors | DEFAULT_ELECTRICAL_SERVICE_25 |  | $0.00 | $4 | $75 | $624 |  |  | Install mc cable connectors for electrical service equipment |
| Circuit Breakers | Replace outdoor main breaker load center, 40 circuit 200 amp labeled | DEFAULT_ELECTRICAL_SERVICE_26 |  | $0.00 | $1,684 | $3,425 | $5,379 |  |  | Replace your outdoor load center with a 40-circuit, 200-amp main breaker. Our pros ensure accurate labeling and robust protection against the elements for safe power distribution. |
| Circuit Breakers | Replace all breakers and load center, 40 circuit 200 amp labeled | DEFAULT_ELECTRICAL_SERVICE_27 |  | $0.00 | $2,250 | $3,300 | $5,344 |  |  | Enhance your electrical system with a 40-circuit, 200-amp load center replacement. Our experts provide precise labeling and robust protection for efficient power distribution. |
| Circuit Breakers | Replace main lug load center, 20 circuit 125 amp labeled | DEFAULT_ELECTRICAL_SERVICE_28 |  | $0.00 | $1,500 | $2,500 | $3,900 |  |  | Upgrade your main lug load center to a 20-circuit, 125-amp unit. We provide precise installation and labeling for improved electrical system management and safety. |
| Circuit Breakers | Replace all breakers and load center, 30 circuit 200 amp labeled | DEFAULT_ELECTRICAL_SERVICE_29 |  | $0.00 | $2,300 | $3,500 | $5,200 |  |  | Upgrade to a 30-circuit, 200-amp load center with new breakers. Our pros ensure accurate labeling and improved electrical safety and reliability for your home. |
| Circuit Breakers | Replace all breakers and load center, 30 circuit 150 amp labeled | DEFAULT_ELECTRICAL_SERVICE_30 |  | $0.00 | $295 | $933 | $2,495 |  |  | Upgrade to a 30-circuit, 150-amp load center with new breakers. We ensure accurate labeling for improved electrical safety and performance in your home. |
| Circuit Breakers | Replace main lug load center, 30 circuit 200 amp labeled | DEFAULT_ELECTRICAL_SERVICE_31 |  | $0.00 | $1,569 | $2,722 | $4,300 |  |  | Replace your main lug load center with a 30-circuit, 200-amp unit. Our professionals ensure proper installation and labeling for enhanced electrical management and safety. |
| Circuit Breakers | Replace all breakers and load center, 20 circuit 100 amp labeled | DEFAULT_ELECTRICAL_SERVICE_32 |  | $0.00 | $1,225 | $2,498 | $4,306 |  |  | Upgrade to a 20-circuit, 100-amp load center with new breakers. Our service includes precise labeling and enhanced protection for efficient and safe power distribution. |
| Dimmer | Replace or install 1000W 3-way Skylark dimmer | DEFAULT_ELECTRICAL_SERVICE_33 |  | $0.00 |  |  |  |  |  | Achieve superior lighting control with a 3-way Skylark dimmer switch. Our pros install or replace these dimmers, allowing you to adjust brightness levels from multiple switches, enhancing convenience and ambiance. |
| Dimmer | Replace or install 600W single pole Diva dimmer | DEFAULT_ELECTRICAL_SERVICE_34 |  | $0.00 | $60 | $140 | $273 |  |  | Enhance your lighting control with a stylish and efficient Diva dimmer switch. We install or replace these dimmers, offering seamless adjustment of brightness levels to suit any mood or occasion. |
| Dimmer | Replace or install 600W 3-way Ariadni dimmer | DEFAULT_ELECTRICAL_SERVICE_35 |  | $0.00 | $32 | $70 | $185 |  |  | Enjoy enhanced lighting flexibility with a 3-way Ariadni dimmer switch. Our experts install or replace these dimmers, enabling convenient control of lights from multiple locations with ease. |
| Dimmer | Replace or install 600W single pole Ariadni dimmer | DEFAULT_ELECTRICAL_SERVICE_36 |  | $0.00 | $112 | $200 | $389 |  |  | Upgrade your home's ambiance with a modern dimmer switch. Our pros install or replace Ariadni dimmers, allowing you to adjust lighting levels smoothly and save energy with precise control. |
| Dimmer | Replace or install 1000W single pole Diva dimmer | DEFAULT_ELECTRICAL_SERVICE_37 |  | $0.00 | $84 | $150 | $300 |  |  | Upgrade to a high-capacity Diva dimmer for powerful lighting control. We install or replace these dimmers, providing smooth operation and energy savings for larger rooms or brighter settings. |
| Lighting Installation | Install Light Fixtures | DEFAULT_ELECTRICAL_SERVICE_38 |  | $0.00 | $159 | $280 | $525 |  |  | Installation of customer supplied light fixtures including chandeliers and standard fixtures |
| Lighting Installation | Led Light Installation | DEFAULT_ELECTRICAL_SERVICE_39 |  | $0.00 | $192 | $429 | $950 |  |  | Install various LED light fixtures and bulbs |
| Outdoor Lighting | Install Exterior Light Prewire | DEFAULT_ELECTRICAL_SERVICE_40 |  | $0.00 | $188 | $350 | $723 |  |  | Install exterior 110 light prewire with switch finish |
| Outdoor Lighting | Install wall mounted porch light at existing location | DEFAULT_ELECTRICAL_SERVICE_41 |  | $0.00 | $195 | $400 | $750 |  |  | Enhance your home's entryway with a stylish wall-mounted porch light. We install new lights at existing locations, offering improved curb appeal and nighttime safety with durable, weather-resistant fixtures. |
| Outdoor Lighting | Install motion detector on existing fixture | DEFAULT_ELECTRICAL_SERVICE_42 |  | $0.00 | $180 | $300 | $644 |  |  | Add convenience and security with a motion detector for your existing fixture. Our experts integrate sensors for automatic lighting, enhancing energy efficiency and deterring intruders with responsive, hands-free illumination. |
| Outdoor Lighting | Install surface mount quartz flood light at existing location 500W | DEFAULT_ELECTRICAL_SERVICE_43 |  | $0.00 |  |  |  |  |  | Illuminate your outdoor space effectively with a powerful quartz floodlight. Our pros install 500W lights at existing locations, providing enhanced security and visibility after dark with energy-efficient lighting. |
| Outdoor Lighting | Install post light with 100W fixture head, up to 25 ft from house, white or black | DEFAULT_ELECTRICAL_SERVICE_44 |  | $0.00 | $365 | $825 | $1,792 |  |  | Brighten pathways and driveways with a post light installation up to 25 feet from your home. We offer 100W fixture heads in white or black, ensuring stylish outdoor lighting that extends safety and aesthetics. |
| Outdoor Lighting | Install new feed and box for outside fixture | DEFAULT_ELECTRICAL_SERVICE_45 |  | $0.00 | $299 | $510 | $1,100 |  |  | Ensure reliable power for your outdoor lighting with a new feed and box installation. Our pros enhance electrical connections, enabling safe and efficient operation for your exterior fixtures, rain or shine. |
| Receptacle Replacement | Install Outlets | DEFAULT_ELECTRICAL_SERVICE_46 |  | $0.00 | $175 | $300 | $600 |  |  | Install various types of electrical outlets in different locations |
| Receptacle Replacement | Install Electrical Outlets (Whole House Replacement) | DEFAULT_ELECTRICAL_SERVICE_47 |  | $0.00 | $295 | $675 | $1,899 |  |  | Install various electrical outlets and circuits throughout the home |
| Receptacle Replacement | Old Work Electrical Box (Whole House Replacement) | DEFAULT_ELECTRICAL_SERVICE_48 |  | $0.00 | $150 | $315 | $750 |  |  | Installation and replacement of various old work electrical boxes for residential applications. |
| Receptacle Replacement | Replace 15 or 20A 120V receptacle outlet | DEFAULT_ELECTRICAL_SERVICE_49 |  | $0.00 | $180 | $400 | $950 |  |  | Upgrade your electrical outlets to handle higher currents safely. Our pros replace outdated receptacles with new ones rated for either 15 or 20 amps, ensuring reliable power for all your devices. |
| Receptacle Replacement | Replace 15A 120V 2 wire receptacle with 3 wire receptacle | DEFAULT_ELECTRICAL_SERVICE_50 |  | $0.00 | $200 | $398 | $795 |  |  | Update your home's wiring for increased safety and functionality. We'll replace old 2-wire outlets with new 3-wire receptacles, providing a more stable electrical connection for modern appliances. |
| Receptacle Replacement | Repair a reverse polarity receptacle | DEFAULT_ELECTRICAL_SERVICE_51 |  | $0.00 | $144 | $225 | $385 |  |  | Ensure your outlets are wired correctly to prevent electrical hazards. Our experts diagnose and repair reverse polarity issues, ensuring outlets are properly grounded for safe operation throughout your home |
| Receptacle Replacement | Replace 15A 120V 2 wire receptacle with GFCI receptacle indoor | DEFAULT_ELECTRICAL_SERVICE_52 |  | $0.00 | $202 | $385 | $870 |  |  | Enhance your indoor electrical safety with GFCI outlets. We'll replace older 2-wire receptacles with new GFCI outlets, offering advanced protection against electrical hazards like shocks and short circuits. |
| Receptacle Replacement | Replace 15A 120V receptacle with GFCI receptacle and outdoor cover | DEFAULT_ELECTRICAL_SERVICE_53 |  | $0.00 | $189 | $355 | $725 |  |  | Upgrade outdoor outlets for improved safety and weather resistance. Our pros replace standard outlets with GFCI models and install durable outdoor covers, ensuring reliable power and protection against moisture. |
| Recessed Lighting | Install 6-inch round, black or white, access from above | DEFAULT_ELECTRICAL_SERVICE_54 |  | $0.00 |  |  |  |  |  | Enjoy easy installation and enhanced lighting with 6-inch round fixtures. We ensure seamless integration by accessing your ceiling from above, providing efficient and attractive lighting solutions. |
| Recessed Lighting | Install 4-inch round, black or white, no access | DEFAULT_ELECTRICAL_SERVICE_55 |  | $0.00 |  |  |  |  |  | Add subtle yet effective lighting with 4-inch round fixtures. Our experts install these compact lights without ceiling access, offering versatile illumination to complement any room decor. |
| Recessed Lighting | Install wall washer fixture, no access | DEFAULT_ELECTRICAL_SERVICE_56 |  | $0.00 | $300 | $595 | $876 |  |  | Illuminate your walls with precision and style using wall washer fixtures. We install these lights without ceiling access, ensuring even distribution of light to highlight artwork and architectural features. |
| Recessed Lighting | Install 5-inch round, black or white, no access | DEFAULT_ELECTRICAL_SERVICE_57 |  | $0.00 |  |  |  |  |  | Enhance your home's lighting with 5-inch round fixtures. Our pros install these stylish lights without needing access to your ceiling, providing efficient and modern illumination for any space. |
| Recessed Lighting | Install 6-inch round, black or white, no access | DEFAULT_ELECTRICAL_SERVICE_58 |  | $0.00 |  |  |  |  |  | Upgrade your ceiling with sleek 6-inch round lighting. Our pros install these fixtures without the need for ceiling access, enhancing your home's ambiance with modern, stylish lighting options. |
| Smoke Detectors | Install new 120V hard wired carbon monoxide detector | DEFAULT_ELECTRICAL_SERVICE_59 |  | $0.00 | $256 | $500 | $949 |  |  | Protect your family from carbon monoxide with a new, hardwired detector. Our experts install devices that integrate into your home's electrical system, providing constant monitoring for early detection. |
| Smoke Detectors | Install new 120V hard wired smoke detector with battery backup | DEFAULT_ELECTRICAL_SERVICE_60 |  | $0.00 | $300 | $600 | $1,167 |  |  | Enhance your home's safety with a new hardwired smoke detector. Our pros install devices that connect directly to your electrical system, ensuring continuous protection with backup battery support. |
| Smoke Detectors | Replace 120V hard wired smoke detector with battery backup | DEFAULT_ELECTRICAL_SERVICE_61 |  | $0.00 | $250 | $478 | $800 |  |  | Upgrade your smoke detection system for reliable home safety. We replace old detectors with new, hardwired models featuring battery backups, ensuring continuous monitoring and peace of mind. |
| Specialty Installations | Ev Charger Installation | DEFAULT_ELECTRICAL_SERVICE_62 |  | $0.00 | $350 | $650 | $1,125 |  |  | Install a new EV charger circuit and associated components |
| Specialty Installations | Generator Installation | DEFAULT_ELECTRICAL_SERVICE_63 |  | $0.00 | $350 | $975 | $2,478 |  |  | Install generator components and connections for safe operation |
| Switch Replacement | Replace 4 way switch | DEFAULT_ELECTRICAL_SERVICE_64 |  | $0.00 | $90 | $235 | $700 |  |  | Optimize control over complex lighting setups with upgraded 4-way switches. We replace existing switches to provide seamless operation from multiple locations, enhancing convenience and functionality. |
| Switch Replacement | Replace 3 way switch | DEFAULT_ELECTRICAL_SERVICE_65 |  | $0.00 | $142 | $250 | $461 |  |  | Enhance convenience and lighting control with updated 3-way switches. We replace old switches to allow you to control lights from multiple locations, improving accessibility and functionality. |
| Switch Replacement | Replace double pole switch | DEFAULT_ELECTRICAL_SERVICE_66 |  | $0.00 | $150 | $250 | $375 |  |  | Upgrade to secure and efficient double pole switches for high-power appliances. Our pros replace outdated switches with new double pole models, ensuring safe operation and durability for heavy-duty use. |
| Switch Replacement | Replace single pole switch | DEFAULT_ELECTRICAL_SERVICE_67 |  | $0.00 | $40 | $140 | $300 |  |  | Upgrade your light switches for better control and efficiency. Our pros replace standard single pole switches, ensuring reliable operation and energy savings with modern, durable alternatives. |
| Switch Replacement | Replace single pole 24 hour digital wall timer | DEFAULT_ELECTRICAL_SERVICE_68 |  | $0.00 | $85 | $225 | $424 |  |  | Automate your home lighting with precision and energy efficiency. Our experts replace traditional switches with advanced digital timers, offering programmable settings for optimal lighting control. |
| Custom Services | Standard Install |  |  | $0.00 |  |  |  |  |  | Install new equipment/fixtures. |
| Custom Services | Diagnostic Visit |  |  | $0.00 |  |  |  |  |  | Something in your home malfunctioning? One of our skilled technicians will come to your house and investigate the issue. |
| Custom Services | Service Visit |  |  | $0.00 |  |  |  |  |  | Something in your home malfunctioning? One of our skilled technicians will come to your house and investigate the issue. |
| Custom Services | Preventative Maintenance |  |  | $0.00 |  |  |  |  |  | Keep your equipment running smoothly with regular maintenance. |

## Garage

- Services: **18** (18 with a task code, 0 without) in **4** categories (` > ` = nested subcategory): Add-On & Maintenance, Book Now, Core Garage Door Services, Specialty & Installation
- Pricing insight available for 6 of 18 services; median of medians **$127**

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Add-On & Maintenance | Garage Door Bottom Seal Replacement | DEFAULT_GARAGE_SERVICE_0 |  | $0.00 |  |  |  |  |  | Remove worn or damaged bottom seal and install a new one to improve insulation, prevent water intrusion, and protect against pests and debris. |
| Book Now | Garage Door Repair | DEFAULT_GARAGE_SERVICE_1 |  | $0.00 |  |  |  | 120 | yes | Repair doors that won’t open or close properly. |
| Book Now | Garage Door Opener Service | DEFAULT_GARAGE_SERVICE_2 |  | $0.00 |  |  |  | 120 | yes | Diagnose and repair opener issues. |
| Book Now | Garage Door Spring Replacement | DEFAULT_GARAGE_SERVICE_3 |  | $0.00 |  |  |  | 120 | yes | Safe spring replacement service. |
| Core Garage Door Services | Garage Door Track Realignment / Repair | DEFAULT_GARAGE_SERVICE_4 |  | $0.00 |  |  |  |  |  | Realign and secure garage door tracks and hardware to ensure smooth, even door movement, reducing strain on the system and preventing further damage. |
| Core Garage Door Services | Garage Door Panel / Section Replacement | DEFAULT_GARAGE_SERVICE_5 |  | $0.00 |  |  |  |  |  | Replace damaged or worn door panels or sections, reinstall hardware, and properly align the door to restore appearance, structure, and safe operation. |
| Core Garage Door Services | Garage Door Roller Replacement (Nylon) | DEFAULT_GARAGE_SERVICE_6 |  | $0.00 |  |  |  |  |  | Replace worn or noisy rollers with durable nylon rollers to improve door movement, reduce noise, and extend the life of the system. |
| Core Garage Door Services | Garage Door Cable Replacement | DEFAULT_GARAGE_SERVICE_7 |  | $0.00 |  |  |  |  |  | Replace damaged or frayed lifting cables, inspect connected components, and rebalance the door to restore safe and reliable operation. |
| Core Garage Door Services | Garage Door Torsion Spring Replacement | DEFAULT_GARAGE_SERVICE_8 |  | $0.00 | $235 | $375 | $550 |  |  | Replace torsion spring(s) and rebalance the garage door for safe, smooth operation. Includes installation and safety check. |
| Core Garage Door Services | Garage Door Opener Repair / Service Call | DEFAULT_GARAGE_SERVICE_9 |  | $0.00 | $89 | $125 | $160 |  |  | Diagnose opener issues and perform minor adjustments, including limits, force settings, sensor alignment, lubrication, and operational testing. |
| Core Garage Door Services | Garage Door Opener Repair and Adjustment | DEFAULT_GARAGE_SERVICE_10 |  | $0.00 | $75 | $99 | $164 |  |  | Repair and adjust the garage door opener and related components, including reconnecting, sensor alignment, minor part replacement, lubrication, and operational testing. |
| Core Garage Door Services | Garage Door Safety Sensor Replacement / Alignment | DEFAULT_GARAGE_SERVICE_11 |  | $0.00 | $115 | $125 | $195 |  |  | Replace and/or align safety sensors and test the safety reversal system. |
| Core Garage Door Services | Garage Door Opener Inspection and Diagnostic | DEFAULT_GARAGE_SERVICE_12 |  | $0.00 | $78 | $129 | $175 |  |  | Inspect and diagnose garage door and opener components to identify issues and confirm safe operation. |
| Specialty & Installation | Garage Door Opener Installation (Chain/Belt Drive) | DEFAULT_GARAGE_SERVICE_13 |  | $0.00 |  |  |  |  |  | Install or replace a garage door opener system (chain or belt drive), including setup, sensor alignment, and full operational testing for smooth and reliable performance. |
| Specialty & Installation | Garage Floor Coating (Polyaspartic Flake System | DEFAULT_GARAGE_SERVICE_14 |  | $0.00 |  |  |  |  |  | Install a durable polyaspartic floor coating system, including surface preparation, base coat, decorative flake broadcast, and protective top coat for a long-lasting, slip-resistant finish. |
| Specialty & Installation | Entry Door Lock & Deadbolt Replacement | DEFAULT_GARAGE_SERVICE_15 |  | $0.00 |  |  |  |  |  | Replace and install entry door locks and deadbolts to improve home security, ensure proper fit, and restore reliable locking function. |
| Specialty & Installation | Wood & Metal Component Replacement | DEFAULT_GARAGE_SERVICE_16 |  | $0.00 |  |  |  |  |  | Replace damaged wood or metal components such as trim, panels, or structural elements to restore integrity, appearance, and durability of the space. |
| Specialty & Installation | Garage Door Installation (Door + Basic Hardware) | DEFAULT_GARAGE_SERVICE_17 |  | $0.00 | $350 | $730 | $1,040 |  |  | Install garage door(s) and associated framing/trim materials as specified, including door hang, hardware setup, and operational testing. |

## Handyman

- Services: **81** (81 with a task code, 0 without) in **10** categories (` > ` = nested subcategory): Assembly & Installation, Carpentry, Cabinets & Trim, Cleanup & General Labor, Doors, Windows & Hardware, Electrical & Lighting, Exterior, Decks & Fencing, Flooring & Tile, HVAC & Ventilation, Painting, Drywall & Finishes, Plumbing
- Pricing insight available for 12 of 81 services; median of medians **$177**
- Measurement-based (sq ft) pricing available: yes

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Assembly & Installation | Furniture Assembly and Installation Services | DEFAULT_HANDYMAN_SERVICE_0 |  | $0.00 |  |  |  |  |  | Assembly and installation of residential furniture items including tables, chairs, sofas, dressers, and benches. |
| Assembly & Installation | Installation - Hot tub | DEFAULT_HANDYMAN_SERVICE_1 |  | $0.00 | $25 | $80 | $582 |  |  | Expert hot tub installation service |
| Carpentry, Cabinets & Trim | Exterior Siding and Trim Repair and Replacement | DEFAULT_HANDYMAN_SERVICE_2 |  | $0.00 |  |  |  |  |  | Repair and replacement of exterior siding, trim, and wood rot deterioration on residential home exterior. |
| Carpentry, Cabinets & Trim | Installation - Cabinets | DEFAULT_HANDYMAN_SERVICE_3 |  | $0.00 | $200 | $344 | $779 |  |  | Expert cabinets installation service |
| Carpentry, Cabinets & Trim | Installation - Crown molding | DEFAULT_HANDYMAN_SERVICE_4 |  | $0.00 | $280 | $556 | $1,363 |  |  | Expert crown molding installation service |
| Cleanup & General Labor | Handyman Service Call Labor - Hourly Rate | DEFAULT_HANDYMAN_SERVICE_5 |  | $0.00 |  |  |  |  |  | Professional handyman labor provided on an hourly basis for residential service calls, repairs, and troubleshooting. |
| Cleanup & General Labor | Site Preparation and Debris Removal Services | DEFAULT_HANDYMAN_SERVICE_6 |  | $0.00 |  |  |  |  |  | Comprehensive site preparation including vegetation removal, debris hauling, ground clearing, and disposal of grass, dirt, rock, and trash. |
| Doors, Windows & Hardware | Closet Door Installation, Repair, and Shelving System | DEFAULT_HANDYMAN_SERVICE_7 |  | $0.00 |  |  |  |  |  | Professional installation, repair, and rehang of closet doors, shelving systems, and floor guides for residential closets. |
| Doors, Windows & Hardware | Closet Remodel with Shelving, Doors, and Hardware Installation | DEFAULT_HANDYMAN_SERVICE_8 |  | $0.00 |  |  |  |  |  | Complete closet renovation including shelving installation, door replacement, hardware mounting, and associated labor and materials. |
| Doors, Windows & Hardware | Door and Cabinet Hardware Repair and Alignment | DEFAULT_HANDYMAN_SERVICE_9 |  | $0.00 |  |  |  |  |  | Professional repair, adjustment, and alignment of residential doors, locks, and cabinet hardware to restore proper operation and function. |
| Doors, Windows & Hardware | Exterior Door and Trim Repair with Wood Rot Treatment | DEFAULT_HANDYMAN_SERVICE_10 |  | $0.00 |  |  |  |  |  | Repair and finishing of exterior doors, trim, and associated hardware including wood rot remediation and paint finish. |
| Doors, Windows & Hardware | Installation - Interior door | DEFAULT_HANDYMAN_SERVICE_11 |  | $0.00 | $165 | $250 | $595 |  |  | Expert interior door installation service |
| Doors, Windows & Hardware | Installation - TV mount | DEFAULT_HANDYMAN_SERVICE_12 |  | $0.00 | $125 | $165 | $250 |  |  | Expert installation service for TV mount |
| Doors, Windows & Hardware | Installation and Repair of Residential Window and Door Screens | DEFAULT_HANDYMAN_SERVICE_13 |  | $0.00 |  |  |  |  |  | Supply and installation of hurricane, solar, and motorized screens for windows, doors, patios, and lanais, including rescreening and repairs. |
| Doors, Windows & Hardware | Installation and Replacement of Interior Window Blinds | DEFAULT_HANDYMAN_SERVICE_14 |  | $0.00 |  |  |  |  |  | Supply and installation of interior window blinds including mini blinds and vertical blinds for residential rooms with removal and labor included. |
| Doors, Windows & Hardware | Installation of Door Sill and Trim Components | DEFAULT_HANDYMAN_SERVICE_15 |  | $0.00 |  |  |  |  |  | Supply and installation of various door sill types including break, top, in, out, jam, and trim sill components for residential door frames. |
| Doors, Windows & Hardware | Installation of Exterior Storm Doors and Weather Sealing | DEFAULT_HANDYMAN_SERVICE_16 |  | $0.00 |  |  |  |  |  | Professional installation of storm doors and replacement of weather seals and weatherstripping for residential exterior doors. |
| Doors, Windows & Hardware | Installation of Garage Door Smooth Control Kits | DEFAULT_HANDYMAN_SERVICE_17 |  | $0.00 |  |  |  |  |  | Supply and installation of multiple garage door smooth control kits for smooth operation and safety. |
| Doors, Windows & Hardware | Installation of Grab Bars and Wall Hardware | DEFAULT_HANDYMAN_SERVICE_18 |  | $0.00 | $150 | $250 | $378 |  |  | Provide professional installation of grab bars and necessary wall hardware for safety and support. |
| Doors, Windows & Hardware | Installation of Hardware, Brackets, and Mounting Accessories | DEFAULT_HANDYMAN_SERVICE_19 |  | $0.00 |  |  |  |  |  | Supply and installation of various hardware components including mounting brackets, rail systems, locks, adhesives, and fastening accessories for residential and commercial applications. |
| Doors, Windows & Hardware | Kitchen Cabinet Repair and Refinishing Services | DEFAULT_HANDYMAN_SERVICE_20 |  | $0.00 |  |  |  |  |  | Professional repair and refinishing of kitchen cabinets including hardware adjustment, door alignment, and finish restoration. |
| Doors, Windows & Hardware | Lock Rekeying and Garage Door Opener Installation Services | DEFAULT_HANDYMAN_SERVICE_21 |  | $0.00 |  |  |  |  |  | Professional rekeying of residential locks, mailbox locks, and smart locks, plus garage door opener installation and replacement. |
| Doors, Windows & Hardware | Repair - Interior door | DEFAULT_HANDYMAN_SERVICE_22 |  | $0.00 | $90 | $150 | $240 |  |  | Expert interior door repair service |
| Doors, Windows & Hardware | Sliding Door and Screen Roller Repair and Replacement | DEFAULT_HANDYMAN_SERVICE_23 |  | $0.00 |  |  |  |  |  | Repair and replacement of rollers, mesh, and hardware for sliding glass doors, screen doors, and patio doors. |
| Electrical & Lighting | Electrical Installation of Duplex Receptacles and Breaker | DEFAULT_HANDYMAN_SERVICE_24 |  | $0.00 | $38 | $189 | $785 |  |  | Provide and install a single duplex receptacle and a 20 amp breaker for electrical service. |
| Electrical & Lighting | Electrical Outlet and Switch Replacement and Repair | DEFAULT_HANDYMAN_SERVICE_25 |  | $0.00 |  |  |  |  |  | Installation and repair of electrical outlets, switches, and dimmer plates throughout the residence. |
| Electrical & Lighting | Gas Fireplace and Range Burner Repair Parts and Installation | DEFAULT_HANDYMAN_SERVICE_26 |  | $0.00 |  |  |  |  |  | Supply and installation of replacement parts for gas fireplaces, ranges, and burner systems including switches, relays, burners, and mechanical components. |
| Electrical & Lighting | Hourly Electrical Services and Light Bulb Replacement | DEFAULT_HANDYMAN_SERVICE_27 |  | $0.00 |  |  |  |  |  | Flexible hourly labor packages for residential electrical work, including light bulb replacement and general electrical maintenance. |
| Electrical & Lighting | Installation - Doorbell | DEFAULT_HANDYMAN_SERVICE_28 |  | $0.00 | $100 | $150 | $236 |  |  | Expert doorbell installation service |
| Electrical & Lighting | Popcorn Ceiling Removal and Drywall Repair | DEFAULT_HANDYMAN_SERVICE_29 |  | $0.00 |  |  |  |  |  | Removal of popcorn ceiling texture, drywall repair of recessed light holes, and ceiling painting. |
| Electrical & Lighting | Repair - Bathroom exhaust fan | DEFAULT_HANDYMAN_SERVICE_30 |  | $0.00 | $115 | $189 | $300 |  |  | Expert bathroom exhaust fan repair service |
| Electrical & Lighting | Repair - Doorbell | DEFAULT_HANDYMAN_SERVICE_31 |  | $0.00 | $65 | $100 | $160 |  |  | Expert doorbell repair service |
| Electrical & Lighting | Repair - Smoke detector | DEFAULT_HANDYMAN_SERVICE_32 |  | $0.00 | $50 | $110 | $175 |  |  | Expert smoke detector repair service |
| Electrical & Lighting | Window Replacement and Recessed Lighting Installation Services | DEFAULT_HANDYMAN_SERVICE_33 |  | $0.00 |  |  |  |  |  | Installation of replacement windows and recessed can lighting fixtures with trim and finishing materials. |
| Exterior, Decks & Fencing | Deck Construction, Repair, and Replacement Services | DEFAULT_HANDYMAN_SERVICE_34 |  | $0.00 |  |  |  |  |  | Comprehensive deck work including framing, board installation, repairs, and complete deck replacement or removal. |
| Exterior, Decks & Fencing | Fence Repair and Diagnostic Service Labor | DEFAULT_HANDYMAN_SERVICE_35 |  | $0.00 |  |  |  |  |  | Professional labor, service calls, diagnostics, and repair work for fence assessment and restoration. |
| Exterior, Decks & Fencing | Fence and Gate Repair and Replacement Services | DEFAULT_HANDYMAN_SERVICE_36 |  | $0.00 |  |  |  |  |  | Labor and materials for fence and gate repair, replacement of fence panels and posts, and demolition of existing fence structures. |
| Exterior, Decks & Fencing | Power Washing and Deck Refinishing Services | DEFAULT_HANDYMAN_SERVICE_37 |  | $0.00 |  |  |  |  |  | Professional power washing and deck staining or refinishing for residential exterior surfaces. |
| Flooring & Tile | Flooring Materials and Installation Services | DEFAULT_HANDYMAN_SERVICE_38 |  | $0.00 |  |  |  |  |  | Supply and installation of flooring materials including countertops, stone surfaces, and finishing work. |
| Flooring & Tile | Installation of Luxury Vinyl Plank Flooring | DEFAULT_HANDYMAN_SERVICE_39 |  | $0.00 |  |  |  |  |  | Professional installation of luxury vinyl plank (LVP) flooring in residential interior spaces, including stair caps and finishing trim. |
| Flooring & Tile | Installation of Residential Flooring Materials and Protective Coverings | DEFAULT_HANDYMAN_SERVICE_40 |  | $0.00 |  |  |  |  |  | Supply and installation of various flooring materials including vinyl plank, laminate, carpet, and tile with protective coverings and finishing treatments. |
| Flooring & Tile | Installation of Vinyl Plank Flooring with Prep and Materials | DEFAULT_HANDYMAN_SERVICE_41 |  | $0.00 |  |  |  |  |  | Vinyl plank flooring installation in interior spaces including bedroom and kitchen, with surface preparation, masking, painting supplies, and all necessary installation materials. |
| Flooring & Tile | Interior Basement Remodel and Carpentry Services | DEFAULT_HANDYMAN_SERVICE_42 |  | $0.00 |  |  |  |  |  | General handyman labor for interior carpentry, trim work, flooring, and basement remodeling projects including lead paint abatement assessment. |
| Flooring & Tile | Removal and Disposal of Residential Carpet and Pad | DEFAULT_HANDYMAN_SERVICE_43 |  | $0.00 |  |  |  |  |  | Removal, take-up, and hauling away of existing carpet and padding materials. |
| Flooring & Tile | Supply and Installation of Mortar Type S and Premix Mortar Mix | DEFAULT_HANDYMAN_SERVICE_44 |  | $0.00 |  |  |  |  |  | Mortar Type S and premix mortar mix materials supplied for masonry and tile work applications. |
| Flooring & Tile | Tile Flooring Installation, Cleaning, and Grout Sealing | DEFAULT_HANDYMAN_SERVICE_45 |  | $0.00 |  |  |  |  |  | Installation of new tile flooring, removal of old tile, grout cleaning across multiple areas, and sealant application for tile and grout protection. |
| HVAC & Ventilation | Air Conditioning System Repair and Refrigerant Recharge | DEFAULT_HANDYMAN_SERVICE_46 |  | $0.00 |  |  |  |  |  | Repair and maintenance of air conditioning systems including compressor, evaporator coil, heat exchanger, refrigerant recharge, and related parts and labor. |
| HVAC & Ventilation | Air Duct Cleaning and General Labor Services | DEFAULT_HANDYMAN_SERVICE_47 |  | $0.00 |  |  |  |  |  | Professional air duct cleaning, filter replacement, and general labor services including post- build cleanup and microbial treatment. |
| HVAC & Ventilation | Dryer Vent Cleaning and Maintenance Service | DEFAULT_HANDYMAN_SERVICE_48 |  | $0.00 |  |  |  |  |  | Professional cleaning and maintenance of residential dryer vents and ductwork to ensure safe operation and efficiency. |
| HVAC & Ventilation | Installation of High-Efficiency HVAC Systems and Components | DEFAULT_HANDYMAN_SERVICE_49 |  | $0.00 |  |  |  |  |  | Installation of new air conditioning units, furnaces, and evaporator coils with varying tonnage and efficiency ratings. |
| Painting, Drywall & Finishes | Caulking and Sealing of Exterior Building Junctions | DEFAULT_HANDYMAN_SERVICE_50 |  | $0.00 |  |  |  |  |  | Application of caulk and sealant materials to exterior junctions and gaps for waterproofing and weatherproofing. |
| Painting, Drywall & Finishes | Drywall and Interior Wall Repair and Patching | DEFAULT_HANDYMAN_SERVICE_51 |  | $0.00 |  |  |  |  |  | Repair, patching, and finishing of drywall damage including cracks, chips, joints, and texture restoration. |
| Painting, Drywall & Finishes | Installation and Finishing of Interior Residential Baseboards | DEFAULT_HANDYMAN_SERVICE_52 |  | $0.00 |  |  |  |  |  | Complete baseboard installation, removal, and finishing including priming and painting with multiple coats. |
| Painting, Drywall & Finishes | Interior Bathroom Finishing and Maintenance Services | DEFAULT_HANDYMAN_SERVICE_53 |  | $0.00 |  |  |  |  |  | Custom interior finishing, painting, cabinetry installation, and general maintenance for residential bathrooms including baseboards and fixtures. |
| Painting, Drywall & Finishes | Interior Drywall and Surface Repair Services | DEFAULT_HANDYMAN_SERVICE_54 |  | $0.00 |  |  |  |  |  | Repair of drywall, sheetrock, and interior surfaces including holes, chips, and damage to fiberglass and acrylic fixtures. |
| Painting, Drywall & Finishes | Interior Paint Touch-Up and Repair Services | DEFAULT_HANDYMAN_SERVICE_55 |  | $0.00 |  |  |  |  |  | Touch-up painting and minor interior paint repairs for residential walls and surfaces. |
| Painting, Drywall & Finishes | Interior Painting and Fastener Supplies for Residential Units | DEFAULT_HANDYMAN_SERVICE_56 |  | $0.00 |  |  |  |  |  | Supply and installation of interior painting materials and structural fasteners including deck screws and screw piles for residential properties. |
| Painting, Drywall & Finishes | Interior Painting, Patching, and Finishing Work | DEFAULT_HANDYMAN_SERVICE_57 |  | $0.00 |  |  |  |  |  | Touch-up painting, spackling, patching, and miscellaneous interior finishing materials and labor. |
| Painting, Drywall & Finishes | Interior Wall Painting Materials and Labor | DEFAULT_HANDYMAN_SERVICE_58 |  | $0.00 |  |  |  |  |  | Supply and application of premium interior wall paint for residential rooms. |
| Painting, Drywall & Finishes | Interior Wall and Ceiling Painting and Preparation | DEFAULT_HANDYMAN_SERVICE_59 |  | $0.00 |  |  |  |  |  | Professional interior painting service including wall and ceiling preparation, priming, and finish application for residential rooms. |
| Plumbing | Angle Stop Valve Replacement and Supply Line Installation | DEFAULT_HANDYMAN_SERVICE_60 |  | $0.00 |  |  |  |  |  | Replacement of angle stop valves and supply lines for water shut-off at fixture connections. |
| Plumbing | Bathroom Fixtures, Hardware, and Wallpaper Installation | DEFAULT_HANDYMAN_SERVICE_61 |  | $0.00 |  |  |  |  |  | Supply and installation of bathroom sinks, faucets, showerheads, accessories, hardware, and wallpaper finishing materials. |
| Plumbing | Bathroom Plumbing Installation and Fixture Replacement | DEFAULT_HANDYMAN_SERVICE_62 |  | $0.00 |  |  |  |  |  | Professional installation and repair of bathroom plumbing fixtures including toilets, vanities, and caulking work across residential bathrooms. |
| Plumbing | Bathroom Remodel with Fixtures, Cabinetry, and Finishes | DEFAULT_HANDYMAN_SERVICE_63 |  | $0.00 |  |  |  |  |  | Complete bathroom renovation including vanity and sink installation, bathtub refinishing, cabinetry, shelving, framing, electrical outlets and switches, and associated carpentry work. |
| Plumbing | Bathroom Tub and Shower Drain Cleaning and Repair | DEFAULT_HANDYMAN_SERVICE_64 |  | $0.00 |  |  |  |  |  | Professional cleaning, repair, and maintenance of residential bathroom tub and shower drains, including stopper replacement and caulking work. |
| Plumbing | Ceiling Fan Installation and Bathroom Fixture Services | DEFAULT_HANDYMAN_SERVICE_65 |  | $0.00 |  |  |  |  |  | Installation and replacement of ceiling fans, bathtub fixtures, and bathroom drain cleaning with associated electrical and plumbing work. |
| Plumbing | Ceramic and Chrome Plumbing Fixtures Installation and Repair | DEFAULT_HANDYMAN_SERVICE_66 |  | $0.00 |  |  |  |  |  | Installation, repair, and replacement of ceramic tiles, chrome fixtures, and plumbing components in residential bathrooms and kitchens. |
| Plumbing | Door Replacement and Installation Services | DEFAULT_HANDYMAN_SERVICE_67 |  | $0.00 |  |  |  |  |  | Professional installation and replacement of interior and exterior doors, including entry doors, garage doors, and shower doors with hardware and trim. |
| Plumbing | Drain Cleaning and Sewer Line Clearing Services | DEFAULT_HANDYMAN_SERVICE_68 |  | $0.00 |  |  |  |  |  | Professional drain cleaning, sewer line clearing, and branch line maintenance for residential and commercial properties. |
| Plumbing | Garbage Disposal Replacement and Installation Labor | DEFAULT_HANDYMAN_SERVICE_69 |  | $0.00 |  |  |  |  |  | Professional labor and materials for removing old garbage disposal and installing new unit in kitchen sink. |
| Plumbing | HVAC and Water Heater Maintenance and Service | DEFAULT_HANDYMAN_SERVICE_70 |  | $0.00 |  |  |  |  |  | Preventive maintenance, tune-ups, and service calls for residential heating, cooling, and water heating systems. |
| Plumbing | Installation of Plumbing Riser Extensions and Cut-Off Valves | DEFAULT_HANDYMAN_SERVICE_71 |  | $0.00 |  |  |  |  |  | Supply and installation of various sized PVC and metal riser extensions, cut-off nipples, and check valves for plumbing system connections. |
| Plumbing | Kitchen and Bathroom Faucet Installation and Replacement | DEFAULT_HANDYMAN_SERVICE_72 |  | $0.00 |  |  |  |  |  | Installation and replacement of kitchen and bathroom faucets, including sink cutouts, P-trap connections, drain assembly, and vanity sink setup. |
| Plumbing | Kitchen and Bathroom Sink Installation and Plumbing Repair | DEFAULT_HANDYMAN_SERVICE_73 |  | $0.00 |  |  |  |  |  | Professional installation, repair, and plumbing hookup of kitchen and bathroom sinks including vanity work, water line connections, and drain setup. |
| Plumbing | Plumbing Installation and Repair Services | DEFAULT_HANDYMAN_SERVICE_74 |  | $0.00 |  |  |  |  |  | Installation, repair, and inspection of residential plumbing lines, connections, and fixtures including PVC pipe, gas lines, and drainage systems. |
| Plumbing | Plumbing Repair and Fixture Replacement Services | DEFAULT_HANDYMAN_SERVICE_75 |  | $0.00 |  |  |  |  |  | Plumbing repairs, fixture replacement, drain work, and caulking for residential bathrooms and kitchens. |
| Plumbing | Plumbing Repair and Fixture Service for Residential Properties | DEFAULT_HANDYMAN_SERVICE_76 |  | $0.00 |  |  |  |  |  | Professional plumbing repair and maintenance including faucet, fixture, drain, and appliance service calls. |
| Plumbing | Supply and Installation of Residential Plumbing Pipe Materials | DEFAULT_HANDYMAN_SERVICE_77 |  | $0.00 |  |  |  |  |  | Various sizes of poly pipe, PVC pipe, and flexible tubing for plumbing system installation and repair. |
| Plumbing | Toilet Installation and Repair Services | DEFAULT_HANDYMAN_SERVICE_78 |  | $0.00 |  |  |  |  |  | Installation, repair, and replacement of residential toilets including seats, fill valves, flappers, and associated hardware. |
| Plumbing | Toilet Installation with Seat, Fill Valve, and Hardware | DEFAULT_HANDYMAN_SERVICE_79 |  | $0.00 |  |  |  |  |  | Installation of toilet fixture including seat, fill valve, flapper, and mounting hardware. |
| Plumbing | Toilet Repair, Replacement, and Installation Services | DEFAULT_HANDYMAN_SERVICE_80 |  | $0.00 |  |  |  |  |  | Professional plumbing labor for toilet repair, replacement, and installation including fill valve service and fixture upgrades. |

## Window & Exterior Cleaning

- Services: **17** (17 with a task code, 0 without) in **4** categories (` > ` = nested subcategory): Book Now, Core Exterior Cleaning, Specialty Surface Cleaning, Window Cleaning
- Pricing insight available for 7 of 17 services; median of medians **$189**
- Industry card image seeded: yes (stock photo)

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Book Now | Window & Exterior Cleaning Inspection Service | DEFAULT_EXTERIOR_SERVICE_0 |  | $0.00 |  |  |  | 120 | yes | Comprehensive evaluation with clear recommendations. |
| Book Now | Window & Exterior Cleaning Repair Service | DEFAULT_EXTERIOR_SERVICE_1 |  | $0.00 |  |  |  | 120 | yes | Professional repair solutions to restore performance. |
| Book Now | Window & Exterior Cleaning Installation or Upgrade | DEFAULT_EXTERIOR_SERVICE_2 |  | $0.00 |  |  |  | 120 | yes | Expert installation or upgrade service. |
| Core Exterior Cleaning | Driveway / Concrete Pressure Wash | DEFAULT_EXTERIOR_SERVICE_3 |  | $0.00 |  |  |  |  |  | High-pressure cleaning of concrete surfaces to remove built-up dirt, stains, and grime, restoring a cleaner appearance and improving overall curb appeal. |
| Core Exterior Cleaning | Exterior Power/Soft Wash (Home + Surrounding Surfaces) | DEFAULT_EXTERIOR_SERVICE_4 |  | $0.00 |  |  |  |  |  | Professional exterior cleaning using the appropriate method (power wash or soft wash) for surfaces like siding, patios, decks, and driveways to safely remove dirt, algae, and buildup. |
| Core Exterior Cleaning | House Soft Wash (Siding + Exterior Surfaces) | DEFAULT_EXTERIOR_SERVICE_5 |  | $0.00 |  |  |  |  |  | Low-pressure soft washing of home exterior surfaces, including siding and surrounding areas, to remove organic growth, dirt, and buildup without damaging materials. |
| Core Exterior Cleaning | Gutter Cleaning | DEFAULT_EXTERIOR_SERVICE_6 |  | $0.00 | $128 | $209 | $299 |  |  | Remove debris from gutters and downspouts and flush where possible. Includes bagging debris. |
| Specialty Surface Cleaning | Natural Stone Cleaning - Whole House | DEFAULT_EXTERIOR_SERVICE_7 |  | $0.00 |  |  |  |  |  | Specialized cleaning of natural stone surfaces using appropriate products and techniques to safely remove dirt and buildup while preserving the integrity and finish of the material. |
| Specialty Surface Cleaning | Solar Panel Cleaning | DEFAULT_EXTERIOR_SERVICE_8 |  | $0.00 | $150 | $199 | $250 |  |  | Clean solar panels using a soft brush and purified-water rinse to remove dirt and residue and improve appearance. |
| Specialty Surface Cleaning | Window/Door Screen Repair or Replacement | DEFAULT_EXTERIOR_SERVICE_9 |  | $0.00 | $40 | $75 | $150 |  |  | Remove, repair/re-screen or replace window and door screens, then reinstall for proper fit and functionality. |
| Window Cleaning | Recurring - Window Washing | DEFAULT_EXTERIOR_SERVICE_10 |  | $0.00 |  |  |  |  |  | Scheduled window cleaning service to maintain clear, streak-free glass and improve natural light on a consistent basis. |
| Window Cleaning | One-Time - Window Washing | DEFAULT_EXTERIOR_SERVICE_11 |  | $0.00 |  |  |  |  |  | One-time professional window cleaning to remove dirt, streaks, and buildup, restoring clarity and improving the overall appearance of the property. |
| Window Cleaning | Skylight Cleaning | DEFAULT_EXTERIOR_SERVICE_12 |  | $0.00 |  |  |  |  |  | Detailed cleaning of skylight glass (interior and exterior where accessible) to remove buildup and improve light transmission into the home. |
| Window Cleaning | Whole-Property Window Cleaning (Interior + Exterior) | DEFAULT_EXTERIOR_SERVICE_13 |  | $0.00 | $128 | $235 | $375 |  |  | Wash all interior and exterior windows throughout the property for clear glass on both sides. |
| Window Cleaning | Window Cleaning (Int/Ext) + Tracks/Sills/Screens | DEFAULT_EXTERIOR_SERVICE_14 |  | $0.00 | $99 | $189 | $325 |  |  | Thorough cleaning of interior and exterior windows, including tracks, sills, and screens, for a clear and detailed finish. |
| Window Cleaning | Exterior Window Cleaning (Glass + Frames) | DEFAULT_EXTERIOR_SERVICE_15 |  | $0.00 | $90 | $157 | $250 |  |  | Clean exterior window glass and frames to a spot-free finish, removing dirt, grime, and environmental debris. |
| Window Cleaning | Commercial Window & Glass Door Cleaning + Sill Wipe | DEFAULT_EXTERIOR_SERVICE_16 |  | $0.00 | $60 | $144 | $300 |  |  | Clean accessible commercial windows and glass doors inside and outside, including sill wipe-down and cobweb removal in reachable areas. |

## Landscaping & Lawn

- Services: **20** (20 with a task code, 0 without) in **4** categories (` > ` = nested subcategory): Core Services, Additional Services, Maintenance & Inspection, Book Now
- Pricing insight available for 0 of 20 services
- Industry card image seeded: yes (stock photo)

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Core Services | Lawn Mowing | DEFAULT_LANDSCAPING_SERVICE_0 |  | $0.00 |  |  |  |  |  | Cuts and maintains grass height to promote healthy growth, improve curb appeal, and keep your lawn looking clean and well-kept. |
| Core Services | Lawn Fertilization | DEFAULT_LANDSCAPING_SERVICE_1 |  | $0.00 |  |  |  |  |  | Applies nutrient-rich treatments to strengthen grass, improve color, and support consistent, healthy growth. |
| Core Services | Weed Control Service | DEFAULT_LANDSCAPING_SERVICE_2 |  | $0.00 |  |  |  |  |  | Targets and removes invasive weeds to protect your lawn and prevent competition for nutrients and water. |
| Core Services | Landscape Maintenance | DEFAULT_LANDSCAPING_SERVICE_3 |  | $0.00 |  |  |  |  |  | Provides ongoing care for lawns and landscaping to maintain appearance and prevent overgrowth or damage. |
| Core Services | Tree and Shrub Trimming | DEFAULT_LANDSCAPING_SERVICE_4 |  | $0.00 |  |  |  |  |  | Trims and shapes trees and shrubs to promote healthy growth and improve overall landscape appearance. |
| Core Services | Sod Installation | DEFAULT_LANDSCAPING_SERVICE_5 |  | $0.00 |  |  |  |  |  | Installs new sod to quickly establish a healthy, uniform lawn and improve outdoor appearance. |
| Additional Services | Seasonal Yard Cleanup | DEFAULT_LANDSCAPING_SERVICE_6 |  | $0.00 |  |  |  |  |  | Removes leaves, debris, and buildup to prepare your yard for seasonal changes and maintain a clean outdoor space. |
| Additional Services | Mulch Installation | DEFAULT_LANDSCAPING_SERVICE_7 |  | $0.00 |  |  |  |  |  | Adds mulch to protect soil, retain moisture, and improve the appearance of garden beds. |
| Additional Services | Landscape Design Service | DEFAULT_LANDSCAPING_SERVICE_8 |  | $0.00 |  |  |  |  |  | Plans and designs outdoor spaces to improve layout, functionality, and curb appeal. |
| Additional Services | Irrigation System Installation | DEFAULT_LANDSCAPING_SERVICE_9 |  | $0.00 |  |  |  |  |  | Installs irrigation systems to ensure consistent watering and improve lawn health. |
| Additional Services | Drainage Solutions | DEFAULT_LANDSCAPING_SERVICE_10 |  | $0.00 |  |  |  |  |  | Addresses water pooling and runoff issues to protect landscaping and prevent property damage. |
| Additional Services | Hardscape Installation | DEFAULT_LANDSCAPING_SERVICE_11 |  | $0.00 |  |  |  |  |  | Installs patios, walkways, and stone features to enhance outdoor living spaces. |
| Maintenance & Inspection | Irrigation System Service | DEFAULT_LANDSCAPING_SERVICE_12 |  | $0.00 |  |  |  |  |  | Inspects and repairs irrigation systems to maintain proper watering and prevent waste. |
| Maintenance & Inspection | Lawn Health Inspection | DEFAULT_LANDSCAPING_SERVICE_13 |  | $0.00 |  |  |  |  |  | Evaluates grass condition, soil health, and problem areas to recommend proper treatment. |
| Maintenance & Inspection | Seasonal Lawn Treatment | DEFAULT_LANDSCAPING_SERVICE_14 |  | $0.00 |  |  |  |  |  | Applies seasonal treatments to protect grass from weather changes and support year-round health. |
| Maintenance & Inspection | Pest Control for Lawn | DEFAULT_LANDSCAPING_SERVICE_15 |  | $0.00 |  |  |  |  |  | Treats lawn pests that can damage grass and landscaping. |
| Maintenance & Inspection | Landscape Maintenance Plan | DEFAULT_LANDSCAPING_SERVICE_16 |  | $0.00 |  |  |  |  |  | Ongoing service plan to maintain lawn health, appearance, and long-term growth. |
| Book Now | Landscaping & Lawn Inspection Service | DEFAULT_LANDSCAPING_SERVICE_17 |  | $0.00 |  |  |  | 120 | yes | Comprehensive evaluation with clear recommendations. |
| Book Now | Landscaping & Lawn Repair Service | DEFAULT_LANDSCAPING_SERVICE_18 |  | $0.00 |  |  |  | 120 | yes | Professional repair solutions to restore performance. |
| Book Now | Landscaping & Lawn Installation or Upgrade | DEFAULT_LANDSCAPING_SERVICE_19 |  | $0.00 |  |  |  | 120 | yes | Expert installation or upgrade service. |

## Appliances

- Services: **21** (21 with a task code, 0 without) in **4** categories (` > ` = nested subcategory): Core Services, Additional Services, Maintenance & Inspection, Book Now
- Pricing insight available for 0 of 21 services
- Industry card image seeded: yes (stock photo)

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Core Services | Appliance Repair | DEFAULT_APPLIANCES_SERVICE_0 |  | $0.00 |  |  |  |  |  | Diagnoses and repairs faulty components to restore proper function and prevent further damage to household appliances. |
| Core Services | Refrigerator Repair | DEFAULT_APPLIANCES_SERVICE_1 |  | $0.00 |  |  |  |  |  | Identifies and fixes cooling issues, leaks, and performance problems to maintain food safety and appliance efficiency. |
| Core Services | Dishwasher Repair | DEFAULT_APPLIANCES_SERVICE_2 |  | $0.00 |  |  |  |  |  | Repairs drainage, cleaning, and mechanical issues to restore proper washing performance and efficiency. |
| Core Services | Oven and Range Repair | DEFAULT_APPLIANCES_SERVICE_3 |  | $0.00 |  |  |  |  |  | Restores heating accuracy and functionality to ensure safe and consistent cooking performance. |
| Core Services | Washer Repair | DEFAULT_APPLIANCES_SERVICE_4 |  | $0.00 |  |  |  |  |  | Fixes leaks, drainage issues, and mechanical failures to restore proper washing cycles and performance. |
| Core Services | Dryer Repair | DEFAULT_APPLIANCES_SERVICE_5 |  | $0.00 |  |  |  |  |  | Repairs heating and airflow issues to improve drying efficiency and reduce wear on clothing. |
| Additional Services | Appliance Installation | DEFAULT_APPLIANCES_SERVICE_6 |  | $0.00 |  |  |  |  |  | Ensures appliances are installed correctly, connected safely, and operating according to manufacturer specifications. |
| Additional Services | Dryer Vent Cleaning | DEFAULT_APPLIANCES_SERVICE_7 |  | $0.00 |  |  |  |  |  | Removes lint buildup from vents to improve airflow, increase efficiency, and reduce fire risk. |
| Additional Services | Leak Diagnosis and Repair | DEFAULT_APPLIANCES_SERVICE_8 |  | $0.00 |  |  |  |  |  | Identifies the source of water leaks and performs repairs to prevent damage and improve appliance performance. |
| Additional Services | Electrical Troubleshooting | DEFAULT_APPLIANCES_SERVICE_9 |  | $0.00 |  |  |  |  |  | Diagnoses electrical faults affecting appliance operation to ensure safe and reliable performance. |
| Additional Services | Smart Appliance Setup | DEFAULT_APPLIANCES_SERVICE_10 |  | $0.00 |  |  |  |  |  | Configures smart appliance features to ensure proper connectivity and functionality. |
| Additional Services | Appliance Cleaning Service | DEFAULT_APPLIANCES_SERVICE_11 |  | $0.00 |  |  |  |  |  | Removes grease, buildup, and residue to improve performance and maintain appliance condition. |
| Additional Services | Parts Replacement Service | DEFAULT_APPLIANCES_SERVICE_12 |  | $0.00 |  |  |  |  |  | Replaces worn or damaged components to restore proper function and extend appliance lifespan. |
| Maintenance & Inspection | Appliance Tune-Up | DEFAULT_APPLIANCES_SERVICE_13 |  | $0.00 |  |  |  |  |  | Inspects and calibrates components to improve efficiency and reduce risk of breakdown. |
| Maintenance & Inspection | Preventative Maintenance Service | DEFAULT_APPLIANCES_SERVICE_14 |  | $0.00 |  |  |  |  |  | Performs routine maintenance to identify issues early and extend appliance life. |
| Maintenance & Inspection | Appliance Inspection | DEFAULT_APPLIANCES_SERVICE_15 |  | $0.00 |  |  |  |  |  | Assesses overall condition and performance to identify potential problems. |
| Maintenance & Inspection | Performance Optimization | DEFAULT_APPLIANCES_SERVICE_16 |  | $0.00 |  |  |  |  |  | Adjusts settings and components to improve efficiency and functionality. |
| Maintenance & Inspection | Filter Replacement Service | DEFAULT_APPLIANCES_SERVICE_17 |  | $0.00 |  |  |  |  |  | Replaces filters to maintain airflow, efficiency, and proper operation. |
| Book Now | Appliances Inspection Service | DEFAULT_APPLIANCES_SERVICE_18 |  | $0.00 |  |  |  | 120 | yes | Comprehensive evaluation with clear recommendations. |
| Book Now | Appliances Repair Service | DEFAULT_APPLIANCES_SERVICE_19 |  | $0.00 |  |  |  | 120 | yes | Professional repair solutions to restore performance. |
| Book Now | Appliances Installation or Upgrade | DEFAULT_APPLIANCES_SERVICE_20 |  | $0.00 |  |  |  | 120 | yes | Expert installation or upgrade service. |

## Automotive

- Services: **19** (19 with a task code, 0 without) in **4** categories (` > ` = nested subcategory): Core Services, Additional Services, Maintenance & Inspection, Book Now
- Pricing insight available for 0 of 19 services
- Industry card image seeded: yes (stock photo)

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Core Services | Mobile Car Detailing | DEFAULT_AUTOMOTIVE_SERVICE_0 |  | $0.00 |  |  |  |  |  | Performs a full interior and exterior cleaning to restore appearance and protect vehicle surfaces. |
| Core Services | Interior Detailing | DEFAULT_AUTOMOTIVE_SERVICE_1 |  | $0.00 |  |  |  |  |  | Deep cleans seats, carpets, and surfaces to remove dirt, stains, and odors from the vehicle interior. |
| Core Services | Exterior Wash and Wax | DEFAULT_AUTOMOTIVE_SERVICE_2 |  | $0.00 |  |  |  |  |  | Cleans and applies protective wax to preserve paint and enhance shine. |
| Core Services | Full Vehicle Detailing | DEFAULT_AUTOMOTIVE_SERVICE_3 |  | $0.00 |  |  |  |  |  | Comprehensive service that cleans, restores, and protects both interior and exterior surfaces. |
| Core Services | Engine Bay Cleaning | DEFAULT_AUTOMOTIVE_SERVICE_4 |  | $0.00 |  |  |  |  |  | Removes grease and buildup from engine components to improve cleanliness and visibility. |
| Core Services | Paint Correction Service | DEFAULT_AUTOMOTIVE_SERVICE_5 |  | $0.00 |  |  |  |  |  | Polishes and corrects surface imperfections to restore paint clarity and finish. |
| Additional Services | Headlight Restoration | DEFAULT_AUTOMOTIVE_SERVICE_6 |  | $0.00 |  |  |  |  |  | Removes oxidation from headlights to improve visibility and restore clarity. |
| Additional Services | Odor Removal Treatment | DEFAULT_AUTOMOTIVE_SERVICE_7 |  | $0.00 |  |  |  |  |  | Eliminates deep-set odors using specialized cleaning and treatment methods. |
| Additional Services | Leather Conditioning | DEFAULT_AUTOMOTIVE_SERVICE_8 |  | $0.00 |  |  |  |  |  | Treats leather surfaces to prevent cracking, fading, and wear. |
| Additional Services | Ceramic Coating Application | DEFAULT_AUTOMOTIVE_SERVICE_9 |  | $0.00 |  |  |  |  |  | Applies long-lasting protective coating to shield paint from contaminants and damage. |
| Additional Services | Window Tinting | DEFAULT_AUTOMOTIVE_SERVICE_10 |  | $0.00 |  |  |  |  |  | Installs tint to reduce heat, improve privacy, and protect interior materials. |
| Additional Services | Wheel and Rim Cleaning | DEFAULT_AUTOMOTIVE_SERVICE_11 |  | $0.00 |  |  |  |  |  | Removes brake dust and buildup to restore wheel appearance and prevent corrosion. |
| Maintenance & Inspection | Vehicle Inspection | DEFAULT_AUTOMOTIVE_SERVICE_12 |  | $0.00 |  |  |  |  |  | Checks key components to identify wear, damage, or performance concerns. |
| Maintenance & Inspection | Maintenance Detailing Plan | DEFAULT_AUTOMOTIVE_SERVICE_13 |  | $0.00 |  |  |  |  |  | Scheduled detailing service to maintain vehicle condition over time. |
| Maintenance & Inspection | Paint Protection Inspection | DEFAULT_AUTOMOTIVE_SERVICE_14 |  | $0.00 |  |  |  |  |  | Evaluates condition of protective coatings and paint surfaces. |
| Maintenance & Inspection | Interior Condition Assessment | DEFAULT_AUTOMOTIVE_SERVICE_15 |  | $0.00 |  |  |  |  |  | Reviews interior wear and recommends cleaning or restoration. |
| Book Now | Automotive Inspection Service | DEFAULT_AUTOMOTIVE_SERVICE_16 |  | $0.00 |  |  |  | 120 | yes | Comprehensive evaluation with clear recommendations. |
| Book Now | Automotive Repair Service | DEFAULT_AUTOMOTIVE_SERVICE_17 |  | $0.00 |  |  |  | 120 | yes | Professional repair solutions to restore performance. |
| Book Now | Automotive Installation or Upgrade | DEFAULT_AUTOMOTIVE_SERVICE_18 |  | $0.00 |  |  |  | 120 | yes | Expert installation or upgrade service. |

## General Contractor

- Services: **108** (108 with a task code, 0 without) in **14** categories (` > ` = nested subcategory): Bathroom Remodeling, Concrete, Foundation & Masonry, Demolition, Site Prep & Cleanup, Electrical & Lighting, Fencing, Decks & Outdoor Structures, Flooring & Tile, Framing, Carpentry & Trim, HVAC, Insulation & Ventilation, Kitchen Remodeling, Painting, Drywall & Finishes, Plumbing & Drainage, Roofing, Gutters & Chimneys, Waterproofing & Restoration, Windows, Doors & Garage
- Pricing insight available for 7 of 108 services; median of medians **$700**
- Industry card image seeded: yes (stock photo)
- Measurement-based (sq ft) pricing available: yes

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Bathroom Remodeling | Bathroom Demolition and Removal Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_0 |  | $0.00 |  |  |  |  |  | Demolition and removal of bathroom fixtures, vanities, and related materials in preparation for remodeling. |
| Bathroom Remodeling | Bathroom Plumbing and Fixture Installation Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_1 |  | $0.00 |  |  |  |  |  | Labor and materials for plumbing work including toilet installation, vanity installation, and related bathroom fixture setup across residential bathrooms. |
| Bathroom Remodeling | Bathroom Remodel and Fixture Refinishing Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_2 |  | $0.00 |  |  |  |  |  | Comprehensive bathroom renovation including tile demolition, bathtub and shower wall reglazing, sink and vanity work, and fixture installation. |
| Bathroom Remodeling | Bathroom Remodel and Shower System Installation | DEFAULT_GENERAL_CONTRACTOR_SERVICE_3 |  | $0.00 |  |  |  |  |  | Comprehensive bathroom remodeling including shower surround installation, wall reglazing, niche work, framing, and labor. |
| Bathroom Remodeling | Bathtub Repair, Refinishing, and Waterproofing Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_4 |  | $0.00 |  |  |  |  |  | Comprehensive bathtub repair, refinishing, waterproofing, and protective coating services including reglazing, vapor barriers, and sealant application. |
| Bathroom Remodeling | Bathtub and Shower Resurfacing with Plumbing Installation | DEFAULT_GENERAL_CONTRACTOR_SERVICE_5 |  | $0.00 |  |  |  |  |  | Professional resurfacing of bathtubs and shower surrounds with epoxy coating, plus installation of shower valves, pans, and fixtures. |
| Bathroom Remodeling | Complete Bathroom Remodel and Renovation Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_6 |  | $0.00 |  |  |  |  |  | Comprehensive bathroom renovation including vanity installation, electrical work, and all associated labor for residential bathrooms. |
| Bathroom Remodeling | Full Bathroom Remodel with Framing and Rough-ins | DEFAULT_GENERAL_CONTRACTOR_SERVICE_7 |  | $0.00 |  |  |  |  |  | Complete bathroom renovation including framing, rough-in preparation, and installation of shower or bathtub surround. |
| Bathroom Remodeling | Installation of Bathroom Exhaust Fan and Venting | DEFAULT_GENERAL_CONTRACTOR_SERVICE_8 |  | $0.00 | $200 | $475 | $1,000 |  |  | Supply and install a new bathroom exhaust fan with proper ducting and venting to the outdoors. |
| Bathroom Remodeling | Installation of Custom Bathroom Vanity and Hardware | DEFAULT_GENERAL_CONTRACTOR_SERVICE_9 |  | $0.00 | $400 | $700 | $1,200 |  |  | Supply and install a custom bathroom vanity along with necessary hardware and fixtures. |
| Bathroom Remodeling | Installation of Shower Doors and Glass Enclosures | DEFAULT_GENERAL_CONTRACTOR_SERVICE_10 |  | $0.00 |  |  |  |  |  | Supply and installation of frameless and framed shower doors, glass enclosures, hardware, and related materials for bathroom shower applications. |
| Bathroom Remodeling | Kitchen and Bathroom Cabinet Refinishing and Hardware Installation | DEFAULT_GENERAL_CONTRACTOR_SERVICE_11 |  | $0.00 |  |  |  |  |  | Professional refinishing, painting, and hardware installation for kitchen and bathroom cabinetry and vanities. |
| Bathroom Remodeling | Kitchen and Bathroom Sink Installation with Plumbing | DEFAULT_GENERAL_CONTRACTOR_SERVICE_12 |  | $0.00 |  |  |  |  |  | Under-mount sink installation including P-trap, drain assembly, and pop-up hardware for kitchen and bathroom applications. |
| Bathroom Remodeling | Master Bathroom and Shower Remodel with Custom Tile | DEFAULT_GENERAL_CONTRACTOR_SERVICE_13 |  | $0.00 |  |  |  |  |  | Complete bathroom renovation including custom tile shower system, surround, and enclosure installation with labor. |
| Bathroom Remodeling | Tile Installation and Finishing for Bathrooms and Showers | DEFAULT_GENERAL_CONTRACTOR_SERVICE_14 |  | $0.00 |  |  |  |  |  | Professional tile installation, finishing, and sealing for bathroom floors, shower walls, shower pans, and backsplash surfaces. |
| Bathroom Remodeling | Tile Installation and Shower System Assembly | DEFAULT_GENERAL_CONTRACTOR_SERVICE_15 |  | $0.00 |  |  |  |  |  | Complete tile installation, shower pan setup, and standard bathroom shower system assembly with hardware connections. |
| Concrete, Foundation & Masonry | Concrete Block Installation and Fence Construction Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_16 |  | $0.00 |  |  |  |  |  | Installation of concrete block units in various sizes for fence, gate, and structural applications. |
| Concrete, Foundation & Masonry | Concrete Driveway, Patio, and Curbing Installation | DEFAULT_GENERAL_CONTRACTOR_SERVICE_17 |  | $0.00 |  |  |  |  |  | Concrete pouring, finishing, and installation for driveways, patios, curbing, and related exterior concrete work. |
| Concrete, Foundation & Masonry | Concrete Foundation and Slab Installation and Demolition | DEFAULT_GENERAL_CONTRACTOR_SERVICE_18 |  | $0.00 |  |  |  |  |  | Concrete work including foundation pads, slabs, piers, demolition, and site preparation with materials and labor. |
| Concrete, Foundation & Masonry | Concrete Leveling and Raising for Driveways and Walkways | DEFAULT_GENERAL_CONTRACTOR_SERVICE_19 |  | $0.00 |  |  |  |  |  | Leveling, raising, and repair of concrete slabs including driveways, walkways, and patios using limestone or polyurethane foam injection and sealcoating. |
| Concrete, Foundation & Masonry | Foundation and Concrete Crack Repair and Injection | DEFAULT_GENERAL_CONTRACTOR_SERVICE_20 |  | $0.00 |  |  |  |  |  | Professional repair of foundation and concrete cracks using injection, patching, and specialized repair techniques. |
| Concrete, Foundation & Masonry | Foundation and Exterior Masonry Repair and Stabilization | DEFAULT_GENERAL_CONTRACTOR_SERVICE_21 |  | $0.00 |  |  |  |  |  | Comprehensive foundation and masonry repairs including concrete breakouts, tuckpointing, crack sealing, pier work, and structural stabilization. |
| Concrete, Foundation & Masonry | Installation and Labor for Foundation Pier and Helical Pile Work | DEFAULT_GENERAL_CONTRACTOR_SERVICE_22 |  | $0.00 |  |  |  |  |  | Foundation repair including helical piles, steel piers, excavation, sheathing inspection, and associated labor for residential structural support. |
| Concrete, Foundation & Masonry | Installation and Restoration of Hardscape Pavers and Asphalt | DEFAULT_GENERAL_CONTRACTOR_SERVICE_23 |  | $0.00 |  |  |  |  |  | Professional installation, repair, and restoration of concrete pavers, asphalt surfaces, and hardscape materials including material, labor, sealing, and site preparation. |
| Concrete, Foundation & Masonry | Installation of Residential Vinyl and Metal Fence Systems | DEFAULT_GENERAL_CONTRACTOR_SERVICE_24 |  | $0.00 |  |  |  |  |  | Installation and materials for vinyl, PVC, aluminum, and steel residential fence panels and gates, including concrete footings. |
| Concrete, Foundation & Masonry | Installation of Steel Truss Anchors and Rebar | DEFAULT_GENERAL_CONTRACTOR_SERVICE_25 |  | $0.00 |  |  |  |  |  | Supply and installation of structural steel components including truss anchors, J-bolts, and rebar for residential and commercial construction. |
| Concrete, Foundation & Masonry | Structural Framing, Leveling, and Foundation Repair Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_26 |  | $0.00 |  |  |  |  |  | Comprehensive structural carpentry including framing, foundation leveling, pier installation, joist and sill repair, and all necessary anchoring and blocking for residential properties. |
| Demolition, Site Prep & Cleanup | Demolition and Site Preparation for Residential Projects | DEFAULT_GENERAL_CONTRACTOR_SERVICE_27 |  | $0.00 |  |  |  |  |  | Demolition, debris removal, and site preparation work including structural teardown and waste hauling. |
| Demolition, Site Prep & Cleanup | Excavation and Grading for Driveway and Landscaping | DEFAULT_GENERAL_CONTRACTOR_SERVICE_28 |  | $0.00 | $1,000 | $2,214 | $5,249 |  |  | Perform excavation and grading work for driveway installation and landscaping preparation. |
| Demolition, Site Prep & Cleanup | Final Cleanup and Post-Construction Walkthrough Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_29 |  | $0.00 |  |  |  |  |  | Final cleaning, debris removal, and walkthrough inspection to prepare the property for occupancy upon project completion. |
| Demolition, Site Prep & Cleanup | Removal and Hauling of Construction Debris and Waste | DEFAULT_GENERAL_CONTRACTOR_SERVICE_30 |  | $0.00 |  |  |  |  |  | Labor and disposal fees for removal, hauling away, and proper disposal of construction debris, old materials, and waste from the job site. |
| Electrical & Lighting | Electrical Panel Upgrade and Circuit Breaker Installation | DEFAULT_GENERAL_CONTRACTOR_SERVICE_31 |  | $0.00 |  |  |  |  |  | Installation and upgrade of electrical panel, circuit breakers, surge protection devices, and emergency disconnect components for whole-home power safety and protection. |
| Electrical & Lighting | Electrical Wiring, Fixtures, and Ceiling Fan Installation | DEFAULT_GENERAL_CONTRACTOR_SERVICE_32 |  | $0.00 |  |  |  |  |  | Installation of electrical wiring, fittings, couplings, and ceiling fan fixtures for residential properties. |
| Electrical & Lighting | Installation of Dehumidifier Systems and Related HVAC Controls | DEFAULT_GENERAL_CONTRACTOR_SERVICE_33 |  | $0.00 |  |  |  |  |  | Installation of whole-home dehumidifier units, dedicated electrical circuits, thermostats, and condensate pump systems for moisture control. |
| Electrical & Lighting | Installation of Residential Christmas and Holiday Lighting | DEFAULT_GENERAL_CONTRACTOR_SERVICE_34 |  | $0.00 |  |  |  |  |  | Professional installation of holiday lighting systems including LED lights, garlands, wreaths, and outdoor electrical components for residential properties. |
| Electrical & Lighting | Installation of Residential Lighting Fixtures and Components | DEFAULT_GENERAL_CONTRACTOR_SERVICE_35 |  | $0.00 |  |  |  |  |  | Supply and installation of various lighting fixtures, kits, and electrical components for residential applications. |
| Electrical & Lighting | Installation of Smoke and Carbon Monoxide Detectors | DEFAULT_GENERAL_CONTRACTOR_SERVICE_36 |  | $0.00 | $100 | $150 | $285 |  |  | Supply and install smoke and carbon monoxide detectors in residential properties. |
| Fencing, Decks & Outdoor Structures | Installation of Outdoor Structures and Patio Covers | DEFAULT_GENERAL_CONTRACTOR_SERVICE_37 |  | $0.00 |  |  |  |  |  | Installation and construction of outdoor structures including pergolas, patio covers, tiki huts, and related outdoor entertainment features. |
| Flooring & Tile | Attic Insulation Removal and Debris Cleanup | DEFAULT_GENERAL_CONTRACTOR_SERVICE_38 |  | $0.00 |  |  |  |  |  | Removal of blown fiberglass, batt insulation, and associated debris from attic floors, walls, and crawl spaces, including cleaning and disinfection. |
| Flooring & Tile | Carpet Installation and Subfloor Preparation Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_39 |  | $0.00 |  |  |  |  |  | Complete carpet installation including removal of old carpet, subfloor preparation, and installation of new carpet with padding. |
| Flooring & Tile | Carpet and Hardwood Flooring Installation and Repair | DEFAULT_GENERAL_CONTRACTOR_SERVICE_40 |  | $0.00 |  |  |  |  |  | Supply and installation of residential carpet, hardwood flooring, padding, and related floor finishing services including stretching, patching, and demolition. |
| Flooring & Tile | Flooring Installation and Property Maintenance Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_41 |  | $0.00 |  |  |  |  |  | Installation of vinyl plank, laminate, and epoxy flooring materials with ongoing property maintenance and protection services. |
| Flooring & Tile | Flooring Installation, Repair, and Hardwood Floor Refinishing | DEFAULT_GENERAL_CONTRACTOR_SERVICE_42 |  | $0.00 |  |  |  |  |  | Interior flooring services including installation, repair, sanding, refinishing, and subfloor work for residential properties. |
| Flooring & Tile | Garage Floor Coating and Crack Repair Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_43 |  | $0.00 |  |  |  |  |  | Professional garage floor coating installation, crack repair, and protective sealing using polyurethane, polyaspartic, and injection systems. |
| Flooring & Tile | Garage Floor Epoxy Coating and Preparation Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_44 |  | $0.00 |  |  |  |  |  | Epoxy garage floor coating application including surface preparation, leveling, tear-off of existing materials, and polyaspartic or polyurea flake finishes. |
| Flooring & Tile | Hardwood Flooring Installation and Furniture Moving Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_45 |  | $0.00 |  |  |  |  |  | Hardwood flooring installation with water-pop stain finish, subfloor preparation, removal of existing flooring, and furniture moving labor. |
| Framing, Carpentry & Trim | Baseboard Installation, Finishing, and Repair Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_46 |  | $0.00 |  |  |  |  |  | Complete baseboard work including removal, installation, painting, and finishing with materials and labor. |
| Framing, Carpentry & Trim | Construction and Finishing of Residential Deck with Railing | DEFAULT_GENERAL_CONTRACTOR_SERVICE_47 |  | $0.00 |  |  |  |  |  | Complete deck construction including framing, decking, stairs, railing installation, and exterior staining and restoration services. |
| Framing, Carpentry & Trim | Finish Carpentry Labor and Trimwork Installation | DEFAULT_GENERAL_CONTRACTOR_SERVICE_48 |  | $0.00 |  |  |  |  |  | Professional finish carpentry labor including trim installation, custom woodwork, and interior/exterior carpentry services. |
| Framing, Carpentry & Trim | Installation and Framing of Residential Deck Structure | DEFAULT_GENERAL_CONTRACTOR_SERVICE_49 |  | $0.00 |  |  |  |  |  | Complete deck construction including framing, decking materials, beauty boards, steps, and associated labor. |
| Framing, Carpentry & Trim | Installation of Residential Baseboards and Trim | DEFAULT_GENERAL_CONTRACTOR_SERVICE_50 |  | $0.00 |  |  |  |  |  | Installation of baseboards and trim materials including labor and finishing. |
| Framing, Carpentry & Trim | Installation of Residential Fencing and Gate Systems | DEFAULT_GENERAL_CONTRACTOR_SERVICE_51 |  | $0.00 |  |  |  |  |  | Installation of various fencing materials including chainlink, ornamental iron, and wood fence sections with gate hardware and ADA-compliant access features. |
| Framing, Carpentry & Trim | Installation of Residential Privacy Fence and Posts | DEFAULT_GENERAL_CONTRACTOR_SERVICE_52 |  | $0.00 |  |  |  |  |  | Installation of residential privacy fence including post holes, materials, and labor for wood or vinyl fence systems. |
| Framing, Carpentry & Trim | Refinishing of Raw Wood Surfaces and Carpentry Work | DEFAULT_GENERAL_CONTRACTOR_SERVICE_53 |  | $0.00 | $350 | $900 | $2,500 |  |  | Restore and refinish raw wood surfaces and perform necessary carpentry work for optimal appearance. |
| Framing, Carpentry & Trim | Replacement of Dock Boards and Labor for Installation | DEFAULT_GENERAL_CONTRACTOR_SERVICE_54 |  | $0.00 | $344 | $527 | $838 |  |  | Provide labor and materials for the replacement of dock boards at the specified location. |
| Framing, Carpentry & Trim | Rough-In and Trim-Out Electrical Work | DEFAULT_GENERAL_CONTRACTOR_SERVICE_55 |  | $0.00 |  |  |  |  |  | Rough-in and trim-out electrical installation including materials and labor for residential wiring and fixtures. |
| HVAC, Insulation & Ventilation | Annual HVAC System Maintenance and Inspection Service | DEFAULT_GENERAL_CONTRACTOR_SERVICE_56 |  | $0.00 |  |  |  |  |  | Comprehensive heating and cooling system tune-up, cleaning, and preventative maintenance inspection. |
| HVAC, Insulation & Ventilation | Attic Air Sealing and Insulation Coverage | DEFAULT_GENERAL_CONTRACTOR_SERVICE_57 |  | $0.00 |  |  |  |  |  | Air sealing, insulation, and weatherization of attic spaces, fixtures, ducts, and thermal barriers to improve energy efficiency. |
| HVAC, Insulation & Ventilation | Crawlspace Inspection, Repair, and Winterization Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_58 |  | $0.00 |  |  |  |  |  | Comprehensive crawlspace maintenance including inspection, insulation installation and repair, support jack installation, door installation, cleaning, and seasonal winterization. |
| HVAC, Insulation & Ventilation | HVAC Mini Split Installation and Thermostat Setup | DEFAULT_GENERAL_CONTRACTOR_SERVICE_59 |  | $0.00 |  |  |  |  |  | Professional installation of mini split HVAC system with 500 series thermostat and labor for residential property. |
| HVAC, Insulation & Ventilation | HVAC System Installation and Replacement Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_60 |  | $0.00 |  |  |  |  |  | Complete HVAC system installation, replacement, and related ductwork and component services including condenser, inducer, and humidity control equipment. |
| HVAC, Insulation & Ventilation | HVAC System Installation, Repair, and Maintenance Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_61 |  | $0.00 |  |  |  |  |  | Professional HVAC installation, repair, replacement, and system estimates for residential air conditioning and climate control equipment. |
| HVAC, Insulation & Ventilation | HVAC and Air Conditioning System Filter Replacement | DEFAULT_GENERAL_CONTRACTOR_SERVICE_62 |  | $0.00 |  |  |  |  |  | Supply and installation of replacement air filters and cartridges for residential HVAC and air conditioning systems. |
| HVAC, Insulation & Ventilation | HVAC and Appliance Service Call with Diagnostic | DEFAULT_GENERAL_CONTRACTOR_SERVICE_63 |  | $0.00 |  |  |  |  |  | Professional service call, diagnostic evaluation, and repair labor for residential HVAC systems and major appliances. |
| HVAC, Insulation & Ventilation | Installation of Commercial Dehumidifiers and Air Movers | DEFAULT_GENERAL_CONTRACTOR_SERVICE_64 |  | $0.00 |  |  |  |  |  | Installation and rental of commercial-grade dehumidifiers and air movers for water damage restoration and crawl space treatment. |
| HVAC, Insulation & Ventilation | Installation of Fiberglass Batts Insulation in Attic and Crawl Space | DEFAULT_GENERAL_CONTRACTOR_SERVICE_65 |  | $0.00 |  |  |  |  |  | Installation of various R-value fiberglass batt insulation in attic, crawl space, walls, and rim joists. |
| Kitchen Remodeling | Demolition of Kitchen Cabinets and Countertops | DEFAULT_GENERAL_CONTRACTOR_SERVICE_66 |  | $0.00 | $738 | $1,229 | $3,120 |  |  | Complete demolition and removal of existing kitchen cabinets and countertops. |
| Kitchen Remodeling | Fabrication and Installation of Kitchen Countertops | DEFAULT_GENERAL_CONTRACTOR_SERVICE_67 |  | $0.00 |  |  |  |  |  | Fabrication and installation of kitchen countertops including edge details and backsplash work. |
| Kitchen Remodeling | Hood Cleaning and Maintenance Service Call | DEFAULT_GENERAL_CONTRACTOR_SERVICE_68 |  | $0.00 |  |  |  |  |  | Professional hood cleaning and equipment maintenance service for kitchen exhaust systems. |
| Kitchen Remodeling | Kitchen Cabinet Painting and Refinishing Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_69 |  | $0.00 |  |  |  |  |  | Professional painting and refinishing of kitchen cabinet doors, bases, and hardware with durable finish options. |
| Kitchen Remodeling | Kitchen Remodel and Paver Installation Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_70 |  | $0.00 |  |  |  |  |  | Kitchen renovation and outdoor paver installation including countertops, borders, and stepping stones with materials and labor. |
| Kitchen Remodeling | Kitchen Remodel with Countertops, Cabinets, and Backsplash | DEFAULT_GENERAL_CONTRACTOR_SERVICE_71 |  | $0.00 |  |  |  |  |  | Comprehensive kitchen remodeling including cabinet installation, countertop fabrication and resurfacing, and backsplash work. |
| Painting, Drywall & Finishes | Drywall Repair and Construction Debris Removal | DEFAULT_GENERAL_CONTRACTOR_SERVICE_72 |  | $0.00 |  |  |  |  |  | Drywall repair work and disposal of associated construction waste and debris. |
| Painting, Drywall & Finishes | Interior Drywall and Surface Primer Application | DEFAULT_GENERAL_CONTRACTOR_SERVICE_73 |  | $0.00 |  |  |  |  |  | Application of primer and sealer products to drywall, ceilings, and interior surfaces in preparation for painting. |
| Painting, Drywall & Finishes | Interior Preparation, Mold Remediation, and Painting Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_74 |  | $0.00 |  |  |  |  |  | Comprehensive interior preparation, mold remediation with HEPA equipment, air quality testing, and interior painting with sanitization. |
| Painting, Drywall & Finishes | Interior and Exterior Paint Supply and Application | DEFAULT_GENERAL_CONTRACTOR_SERVICE_75 |  | $0.00 |  |  |  |  |  | Supply and application of Sherwin Williams interior and exterior acrylic latex paint products for residential walls and surfaces. |
| Painting, Drywall & Finishes | Stucco Repair and Patching Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_76 |  | $0.00 |  |  |  |  |  | Professional repair, patching, and repainting of stucco exterior surfaces including elastomeric color coat application. |
| Painting, Drywall & Finishes | Wallpaper Installation and Removal Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_77 |  | $0.00 |  |  |  |  |  | Professional wallpaper installation, removal, and related labor and materials for residential interior walls. |
| Plumbing & Drainage | Backflow Testing and Inspection Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_78 |  | $0.00 |  |  |  |  |  | Professional backflow prevention device testing, inspection, and certification for residential and commercial plumbing systems. |
| Plumbing & Drainage | Plumbing Repair, Leak Detection, and Water Repipe Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_79 |  | $0.00 |  |  |  |  |  | Professional plumbing services including leak detection, repair, water line replacement, and system testing for residential properties. |
| Plumbing & Drainage | Plumbing Service Call and Drain Cleaning Labor | DEFAULT_GENERAL_CONTRACTOR_SERVICE_80 |  | $0.00 |  |  |  |  |  | Professional plumbing labor for service calls, drain cleaning, and general maintenance work. |
| Plumbing & Drainage | Plumbing Service Call and Leak Repair Labor | DEFAULT_GENERAL_CONTRACTOR_SERVICE_81 |  | $0.00 |  |  |  |  |  | First-hour technician labor for plumbing service calls, leak diagnosis, and repair work. |
| Plumbing & Drainage | Spring Plumbing System Start-Up and Water Heater Service | DEFAULT_GENERAL_CONTRACTOR_SERVICE_82 |  | $0.00 |  |  |  |  |  | Seasonal activation and inspection of plumbing systems, water heater start-up, and related maintenance services. |
| Roofing, Gutters & Chimneys | Chimney Cap, Liner, and Protective Wrapping Installation | DEFAULT_GENERAL_CONTRACTOR_SERVICE_83 |  | $0.00 |  |  |  |  |  | Installation and sealing of chimney caps, liners, hoods, chase covers, and protective wrapping to prevent water intrusion and ensure safe flue operation. |
| Roofing, Gutters & Chimneys | Chimney Repair, Flashing Installation, and Waterproofing | DEFAULT_GENERAL_CONTRACTOR_SERVICE_84 |  | $0.00 |  |  |  |  |  | Comprehensive chimney maintenance including structural repairs, flashing installation, crown sealing, and waterproofing to ensure proper function and weather protection. |
| Roofing, Gutters & Chimneys | Complete Flat Roof Replacement and Coating Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_85 |  | $0.00 |  |  |  |  |  | Comprehensive flat roof replacement, underlayment installation, and protective coatings including TPO, elastomeric, and silicone systems with labor and materials. |
| Roofing, Gutters & Chimneys | Downspout Demolition, Removal, and Reinstallation | DEFAULT_GENERAL_CONTRACTOR_SERVICE_86 |  | $0.00 |  |  |  |  |  | Demolition, removal, and reinstallation of aluminum downspouts for residential drainage systems. |
| Roofing, Gutters & Chimneys | Foundation and Basement Drainage System Installation | DEFAULT_GENERAL_CONTRACTOR_SERVICE_87 |  | $0.00 |  |  |  |  |  | Installation of interior and exterior drainage systems including French drains, sump pumps, gutters, and waterproofing materials for basements and crawlspaces. |
| Roofing, Gutters & Chimneys | Gutter Cleaning and Maintenance Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_88 |  | $0.00 |  |  |  |  |  | Professional cleaning and inspection of residential gutters and downspouts to remove debris and ensure proper drainage. |
| Roofing, Gutters & Chimneys | Installation and Reconnection of Residential Downspouts | DEFAULT_GENERAL_CONTRACTOR_SERVICE_89 |  | $0.00 |  |  |  |  |  | Supply and installation of aluminum or steel downspouts in standard sizes (2x3 and 3x4 inches) for single and multi-story residential properties, including custom offsets and reconnections. |
| Roofing, Gutters & Chimneys | Installation and Repair of Aluminum Seamless Gutters and Downspouts | DEFAULT_GENERAL_CONTRACTOR_SERVICE_90 |  | $0.00 |  |  |  |  |  | Supply and installation of aluminum seamless gutters in various sizes (5" to 7") with matching downspouts and leaf guard protection. |
| Roofing, Gutters & Chimneys | Installation of Asphalt Shingles and Roofing Materials | DEFAULT_GENERAL_CONTRACTOR_SERVICE_91 |  | $0.00 |  |  |  |  |  | Complete roof replacement including ice and water barrier, starter shingles, field shingles, ridge cap, valley metal, pipe jacks, and synthetic felt underlayment installation. |
| Roofing, Gutters & Chimneys | Installation of Chimney Flashing and Roof Sealing Materials | DEFAULT_GENERAL_CONTRACTOR_SERVICE_92 |  | $0.00 |  |  |  |  |  | Installation of chimney flashing, caps, step flashing, and roofing caulk to seal and protect chimney penetrations on residential roofs. |
| Roofing, Gutters & Chimneys | Installation of Residential Roof Drip Edge and Fascia | DEFAULT_GENERAL_CONTRACTOR_SERVICE_93 |  | $0.00 |  |  |  |  |  | Installation of drip edge and fascia materials along roof perimeter to direct water runoff and protect structural edges. |
| Roofing, Gutters & Chimneys | Installation of Residential Roof Vents and Ridge Ventilation | DEFAULT_GENERAL_CONTRACTOR_SERVICE_94 |  | $0.00 |  |  |  |  |  | Installation of roof vents, ridge vents, gable vents, and attic ventilation systems for residential properties. |
| Roofing, Gutters & Chimneys | Installation of Sump Pump Systems and Condensation Drainage | DEFAULT_GENERAL_CONTRACTOR_SERVICE_95 |  | $0.00 |  |  |  |  |  | Professional installation of sump pump systems, condensation pumps, discharge piping, and related waterproofing equipment for crawlspaces and basements. |
| Roofing, Gutters & Chimneys | Residential Roof Repair and Shingle Replacement Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_96 |  | $0.00 |  |  |  |  |  | Professional roof repair, shingle replacement, ridge vent installation, and protective coating services for residential properties. |
| Roofing, Gutters & Chimneys | Residential Roof Replacement with Architectural Shingles | DEFAULT_GENERAL_CONTRACTOR_SERVICE_97 |  | $0.00 |  |  |  |  |  | Complete tear-off and replacement of residential roof with high-quality architectural shingles and associated labor. |
| Roofing, Gutters & Chimneys | Roof Installation with Materials and Fasteners | DEFAULT_GENERAL_CONTRACTOR_SERVICE_98 |  | $0.00 |  |  |  |  |  | Complete roofing installation including shingles, underlayment, ice and water shield, flashing, ridge caps, and all necessary fasteners and hardware. |
| Roofing, Gutters & Chimneys | Roof Repair and Maintenance Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_99 |  | $0.00 |  |  |  |  |  | Comprehensive roof repair, maintenance, and material installation including leak sealing, underlayment, ridge caps, and starter strips. |
| Roofing, Gutters & Chimneys | Roof Tear-Off, Replacement, and Shingling Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_100 |  | $0.00 |  |  |  |  |  | Complete roof replacement including tear-off of existing shingles, deck preparation, and installation of new shingled roofing system. |
| Roofing, Gutters & Chimneys | Roof, Soffit, Fascia and Gutter Repair and Replacement | DEFAULT_GENERAL_CONTRACTOR_SERVICE_101 |  | $0.00 |  |  |  |  |  | Professional repair and replacement of roofing materials, soffit, fascia, gutters, and related exterior trim components. |
| Roofing, Gutters & Chimneys | Roofing Materials and Waterproofing Installation | DEFAULT_GENERAL_CONTRACTOR_SERVICE_102 |  | $0.00 |  |  |  |  |  | Supply and installation of roofing underlayment, flashing, waterproofing membranes, and protective materials for roof weatherization. |
| Roofing, Gutters & Chimneys | Waterproofing, Vapor Barrier, and Protective Coating Installation | DEFAULT_GENERAL_CONTRACTOR_SERVICE_103 |  | $0.00 |  |  |  |  |  | Application and installation of waterproofing membranes, vapor barriers, moisture protection films, sealants, and protective coatings throughout the structure. |
| Waterproofing & Restoration | Antimicrobial Treatment and Odor Elimination Services | DEFAULT_GENERAL_CONTRACTOR_SERVICE_104 |  | $0.00 |  |  |  |  |  | Professional antimicrobial spraying, enzymatic treatment, sanitization fogging, and odor elimination for residential spaces including attics and crawl spaces. |
| Waterproofing & Restoration | Installation of Containment Barriers and Protective Sheeting | DEFAULT_GENERAL_CONTRACTOR_SERVICE_105 |  | $0.00 |  |  |  |  |  | Setup and installation of plastic containment barriers, airlocks, decontamination chambers, and protective sheeting for work area isolation and dust control. |
| Windows, Doors & Garage | Installation of Garage Door Opener Hardware and Mounting Components | DEFAULT_GENERAL_CONTRACTOR_SERVICE_106 |  | $0.00 |  |  |  |  |  | Supply and installation of garage door opener tracks, mounting angles, housings, and associated hardware components. |
| Windows, Doors & Garage | Installation of Residential Windows and Glass Units | DEFAULT_GENERAL_CONTRACTOR_SERVICE_107 |  | $0.00 |  |  |  |  |  | Supply and installation of standard residential windows including double-hung, single-slider, picture windows, and insulated glass units with various frame materials and energy-efficient coatings. |

## Air Duct Cleaning

- Services: **19** (19 with a task code, 0 without) in **4** categories (` > ` = nested subcategory): Core Services, Additional Services, Maintenance & Inspection, Book Now
- Pricing insight available for 0 of 19 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Core Services | Air Duct Cleaning | DEFAULT_AIR_DUCT_SERVICE_0 |  | $0.00 |  |  |  |  |  | Removes dust, debris, and contaminants from ductwork to improve airflow and support cleaner indoor air. |
| Core Services | Dryer Vent Cleaning | DEFAULT_AIR_DUCT_SERVICE_1 |  | $0.00 |  |  |  |  |  | Clears lint buildup from vents to improve dryer efficiency and reduce fire hazards. |
| Core Services | HVAC System Cleaning | DEFAULT_AIR_DUCT_SERVICE_2 |  | $0.00 |  |  |  |  |  | Cleans internal HVAC components to improve system performance and airflow. |
| Core Services | Vent Cleaning | DEFAULT_AIR_DUCT_SERVICE_3 |  | $0.00 |  |  |  |  |  | Removes buildup from vents to improve air circulation throughout the home. |
| Core Services | Return Air Cleaning | DEFAULT_AIR_DUCT_SERVICE_4 |  | $0.00 |  |  |  |  |  | Cleans return ducts to support proper airflow and system efficiency. |
| Additional Services | Sanitization Treatment | DEFAULT_AIR_DUCT_SERVICE_5 |  | $0.00 |  |  |  |  |  | Applies antimicrobial treatment to reduce bacteria and contaminants in duct systems. |
| Additional Services | Deodorization Service | DEFAULT_AIR_DUCT_SERVICE_6 |  | $0.00 |  |  |  |  |  | Neutralizes odors within ductwork to improve indoor air freshness. |
| Additional Services | Mold Treatment | DEFAULT_AIR_DUCT_SERVICE_7 |  | $0.00 |  |  |  |  |  | Removes mold growth from duct systems to protect air quality and system health. |
| Additional Services | Air Filter Replacement | DEFAULT_AIR_DUCT_SERVICE_8 |  | $0.00 |  |  |  |  |  | Replaces filters to maintain airflow and improve system efficiency. |
| Additional Services | Duct Sealing Service | DEFAULT_AIR_DUCT_SERVICE_9 |  | $0.00 |  |  |  |  |  | Seals leaks in ductwork to improve efficiency and reduce energy loss. |
| Additional Services | Air Purification Add-On | DEFAULT_AIR_DUCT_SERVICE_10 |  | $0.00 |  |  |  |  |  | Adds purification solutions to improve indoor air quality and reduce airborne contaminants. |
| Maintenance & Inspection | Airflow Inspection | DEFAULT_AIR_DUCT_SERVICE_11 |  | $0.00 |  |  |  |  |  | Evaluates airflow to identify inefficiencies and system restrictions. |
| Maintenance & Inspection | Indoor Air Quality Inspection | DEFAULT_AIR_DUCT_SERVICE_12 |  | $0.00 |  |  |  |  |  | Assesses air quality to identify pollutants and system issues. |
| Maintenance & Inspection | Duct Inspection | DEFAULT_AIR_DUCT_SERVICE_13 |  | $0.00 |  |  |  |  |  | Inspects ductwork for damage, leaks, or buildup. |
| Maintenance & Inspection | System Efficiency Check | DEFAULT_AIR_DUCT_SERVICE_14 |  | $0.00 |  |  |  |  |  | Evaluates HVAC performance to ensure efficient operation. |
| Maintenance & Inspection | Maintenance Cleaning Service | DEFAULT_AIR_DUCT_SERVICE_15 |  | $0.00 |  |  |  |  |  | Provides routine cleaning to maintain airflow and system performance |
| Book Now | Air Duct Cleaning Inspection Service | DEFAULT_AIR_DUCT_SERVICE_16 |  | $0.00 |  |  |  | 120 | yes | Comprehensive evaluation with clear recommendations. |
| Book Now | Air Duct Cleaning Repair Service | DEFAULT_AIR_DUCT_SERVICE_17 |  | $0.00 |  |  |  | 120 | yes | Professional repair solutions to restore performance. |
| Book Now | Air Duct Cleaning Installation or Upgrade | DEFAULT_AIR_DUCT_SERVICE_18 |  | $0.00 |  |  |  | 120 | yes | Expert installation or upgrade service. |

## Pest Control

- Services: **22** (22 with a task code, 0 without) in **4** categories (` > ` = nested subcategory): Core Services, Additional Services, Maintenance & Inspection, Book Now
- Pricing insight available for 0 of 22 services
- Industry card image seeded: yes (stock photo)

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Core Services | Pest Inspection | DEFAULT_PEST_SERVICE_0 |  | $0.00 |  |  |  |  |  | Comprehensive inspection to identify pest activity, entry points, and contributing conditions, with clear recommendations for effective treatment and prevention. |
| Core Services | Pest Treatment Service | DEFAULT_PEST_SERVICE_1 |  | $0.00 |  |  |  |  |  | General pest treatment targeting common household pests using safe and effective methods to eliminate activity and reduce the risk of recurrence. |
| Core Services | Termite Treatment | DEFAULT_PEST_SERVICE_2 |  | $0.00 |  |  |  |  |  | Specialized treatment to eliminate termites and protect structural components, using proven methods to stop active infestations and prevent future damage. |
| Core Services | Rodent Control | DEFAULT_PEST_SERVICE_3 |  | $0.00 |  |  |  |  |  | Service to remove and control rodents, including trapping, identification of entry points, and recommendations to prevent re-entry. |
| Core Services | Insect Control | DEFAULT_PEST_SERVICE_4 |  | $0.00 |  |  |  |  |  | Treatment for common insects such as ants, spiders, and roaches, targeting infestation areas to eliminate activity and improve overall home hygiene. |
| Additional Services | Outdoor Pest Control | DEFAULT_PEST_SERVICE_5 |  | $0.00 |  |  |  |  |  | Exterior pest control service targeting yard, perimeter, and outdoor areas to reduce pest populations and prevent entry into the home. |
| Additional Services | Wasp Nest Removal | DEFAULT_PEST_SERVICE_6 |  | $0.00 |  |  |  |  |  | Safe removal of wasp nests and treatment of affected areas to reduce risk and prevent re-infestation. |
| Additional Services | Mosquito Treatment | DEFAULT_PEST_SERVICE_7 |  | $0.00 |  |  |  |  |  | Treatment of outdoor areas to reduce mosquito populations, targeting breeding and resting zones for improved comfort and protection. |
| Additional Services | Flea Treatment | DEFAULT_PEST_SERVICE_8 |  | $0.00 |  |  |  |  |  | Targeted treatment to eliminate fleas from indoor and outdoor areas, helping break the life cycle and prevent reinfestation. |
| Additional Services | Bed Bug Treatment | DEFAULT_PEST_SERVICE_9 |  | $0.00 |  |  |  |  |  | Specialized treatment plan to eliminate bed bugs, including targeted applications and follow-up recommendations to fully resolve infestations. |
| Additional Services | Preventative Barrier Treatment | DEFAULT_PEST_SERVICE_10 |  | $0.00 |  |  |  |  |  | Application of a protective barrier around the home to block pest entry points and reduce the likelihood of future infestations. |
| Maintenance & Inspection | Preventative Pest Control | DEFAULT_PEST_SERVICE_11 |  | $0.00 |  |  |  |  |  | Ongoing pest control service designed to prevent infestations through routine treatments and proactive maintenance. |
| Maintenance & Inspection | Pest Monitoring | DEFAULT_PEST_SERVICE_12 |  | $0.00 |  |  |  |  |  | Service to monitor pest activity using inspections or devices, helping detect issues early and guide treatment decisions. |
| Maintenance & Inspection | Pest Inspection Follow-Up | DEFAULT_PEST_SERVICE_13 |  | $0.00 |  |  |  |  |  | Follow-up inspection to evaluate treatment effectiveness, check for remaining activity, and adjust the plan if needed. |
| Maintenance & Inspection | Annual Pest Plan | DEFAULT_PEST_SERVICE_14 |  | $0.00 |  |  |  |  |  | Year-round pest management plan with scheduled treatments and inspections to maintain consistent protection and peace of mind. |
| Maintenance & Inspection | Seasonal Pest Treatment | DEFAULT_PEST_SERVICE_15 |  | $0.00 |  |  |  |  |  | Targeted pest control service aligned with seasonal pest activity to address common infestations at the right time of year. |
| Book Now | Pest Inspection | DEFAULT_PEST_SERVICE_16 |  | $0.00 |  |  |  | 120 | yes | Inspection to identify pest activity, entry points, and recommend the appropriate treatment plan. |
| Book Now | General Pest Treatment | DEFAULT_PEST_SERVICE_17 |  | $0.00 |  |  |  | 120 | yes | Treatment for common household pests (ants, spiders, insects) using safe and effective methods for immediate relief. |
| Book Now | Ant Control | DEFAULT_PEST_SERVICE_18 |  | $0.00 |  |  |  | 120 | yes | Treatment targeting ant infestations, including identification of source and application of solutions to eliminate and prevent return. |
| Book Now | Cockroach Treatment | DEFAULT_PEST_SERVICE_19 |  | $0.00 |  |  |  | 120 | yes | Service to eliminate cockroaches using targeted treatment methods to address infestation and prevent recurrence. |
| Book Now | Rodent Control | DEFAULT_PEST_SERVICE_20 |  | $0.00 |  |  |  | 120 | yes | Service to remove and control rodents, including trapping, exclusion recommendations, and prevention strategies. |
| Book Now | Wasp Nest Removal | DEFAULT_PEST_SERVICE_21 |  | $0.00 |  |  |  | 120 | yes | Safe removal of wasp nests and treatment of affected areas to reduce risk and prevent re-infestation. |

## Painting

- Services: **41** (41 with a task code, 0 without) in **6** categories (` > ` = nested subcategory): Add-On Services, Book Now, Commercial Services, Core Painting, Exterior Components, Prep & Repair
- Pricing insight available for 23 of 41 services; median of medians **$1,541**
- Industry card image seeded: yes (stock photo)
- Measurement-based (sq ft) pricing available: yes

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Add-On Services | Touch-Up Painting | DEFAULT_PAINT_SERVICE_0 |  | $0.00 |  |  |  |  |  | Targeted painting to repair scuffs, chips, or small damaged areas, restoring a clean and uniform appearance. |
| Add-On Services | Trim & Baseboard Painting | DEFAULT_PAINT_SERVICE_1 |  | $0.00 |  |  |  |  |  | Painting of trim, baseboards, and molding to enhance detail and provide a polished final look. |
| Add-On Services | Door Painting | DEFAULT_PAINT_SERVICE_2 |  | $0.00 |  |  |  |  |  | Painting of interior or exterior doors to refresh appearance and protect surfaces from wear. |
| Add-On Services | Accent Wall Painting | DEFAULT_PAINT_SERVICE_3 |  | $0.00 |  |  |  |  |  | Painting of a single wall with a different color or finish to create a focal point within a room. |
| Add-On Services | Installation of Roller Shades and Painting Supplies | DEFAULT_PAINT_SERVICE_4 |  | $0.00 | $150 | $225 | $313 |  |  | Supply and install roller shades along with necessary painting materials and supplies. |
| Add-On Services | Interior Painting with Sherwin Williams Emerald Urethane Enamel | DEFAULT_PAINT_SERVICE_5 |  | $0.00 | $400 | $1,458 | $4,400 |  |  | Provide interior painting services using Sherwin Williams Emerald Urethane Trim Enamel for a smooth and durable finish. |
| Book Now | Interior Painting Service | DEFAULT_PAINT_SERVICE_6 |  | $0.00 |  |  |  | 120 | yes | Professional interior painting for a fresh new look. |
| Book Now | Exterior Painting Service | DEFAULT_PAINT_SERVICE_7 |  | $0.00 |  |  |  | 120 | yes | Enhance curb appeal with exterior painting. |
| Book Now | Room Repaint & Color Update | DEFAULT_PAINT_SERVICE_8 |  | $0.00 |  |  |  | 120 | yes | Update a room with a new color and finish. |
| Commercial Services | Commercial Painting | DEFAULT_PAINT_SERVICE_9 |  | $0.00 |  |  |  |  |  | Professional painting service for commercial spaces, focused on durability, efficiency, and minimal disruption to operations. |
| Core Painting | Interior Painting - Per Room | DEFAULT_PAINT_SERVICE_10 |  | $0.00 |  |  |  |  |  | Interior painting service for a single room, including walls and basic prep, delivering a clean, even finish that refreshes the space. |
| Core Painting | Interior Painting - Whole Home | DEFAULT_PAINT_SERVICE_11 |  | $0.00 |  |  |  |  |  | Full-home interior painting covering walls, ceilings, and trim as specified, providing a consistent, refreshed look throughout the home. |
| Core Painting | Exterior Painting - Full Home | DEFAULT_PAINT_SERVICE_12 |  | $0.00 |  |  |  |  |  | Complete exterior painting service including siding and major surfaces, with proper prep and coatings designed for durability and weather protection. |
| Core Painting | Cabinet Painting | DEFAULT_PAINT_SERVICE_13 |  | $0.00 |  |  |  |  |  | Cabinet refinishing service that cleans, sands, and applies durable coatings to update kitchen or bathroom cabinets with a smooth, long-lasting finish. |
| Core Painting | Labor and Material for Interior Staining Services | DEFAULT_PAINT_SERVICE_14 |  | $0.00 | $960 | $1,590 | $4,000 |  |  | Provide professional labor and materials for interior staining projects. |
| Core Painting | Interior Ceiling Painting for Residential Properties | DEFAULT_PAINT_SERVICE_15 |  | $0.00 | $273 | $784 | $1,632 |  |  | Provide professional painting services for interior ceilings using premium paint. |
| Core Painting | Interior and Exterior Painting Services for Residential Properties | DEFAULT_PAINT_SERVICE_16 |  | $0.00 | $300 | $700 | $1,700 |  |  | Professional painting services for both interior and exterior surfaces, including doors, trim, and cabinets. |
| Core Painting | Interior Painting of Residential Rooms and Ceilings | DEFAULT_PAINT_SERVICE_17 |  | $0.00 | $600 | $1,200 | $2,600 |  |  | Complete interior painting service including preparation, labor, and materials for residential rooms. |
| Core Painting | Interior Painting of Residential Rooms with Color Change | DEFAULT_PAINT_SERVICE_18 |  | $0.00 | $433 | $865 | $2,391 |  |  | Complete interior painting of residential rooms, including color and sheen changes as needed. |
| Core Painting | Interior Painting for Residential Rooms and Cabinetry | DEFAULT_PAINT_SERVICE_19 |  | $0.00 | $725 | $1,886 | $4,449 |  |  | Complete interior painting services for various residential rooms and cabinetry, including full service and no trim options. |
| Core Painting | Interior Painting for Residential Spaces | DEFAULT_PAINT_SERVICE_20 |  | $0.00 | $1,771 | $3,336 | $5,732 |  |  | Complete interior painting services including labor and materials for various rooms and areas. |
| Core Painting | Interior and Exterior Painting with Sherwin Williams Products | DEFAULT_PAINT_SERVICE_21 |  | $0.00 | $519 | $1,472 | $4,550 |  |  | Application of high-quality Sherwin Williams acrylic latex paint for both interior and exterior surfaces. |
| Core Painting | Interior and Exterior Painting for Residential Properties | DEFAULT_PAINT_SERVICE_22 |  | $0.00 | $1,300 | $3,242 | $6,276 |  |  | Professional painting services for walls, ceilings, trim, and exterior surfaces using high-quality paint. |
| Core Painting | Interior Wall Painting for Two Bedroom Units | DEFAULT_PAINT_SERVICE_23 |  | $0.00 | $350 | $500 | $900 |  |  | Provide professional painting services for the interior walls of two bedroom units. |
| Core Painting | Interior Painting for Residential Walls, Ceilings, and Trim | DEFAULT_PAINT_SERVICE_24 |  | $0.00 | $900 | $2,100 | $4,550 |  |  | Professional painting services for interior walls, ceilings, and trim in residential spaces. |
| Core Painting | Interior Wall and Ceiling Painting for Residential Spaces | DEFAULT_PAINT_SERVICE_25 |  | $0.00 | $503 | $1,103 | $3,155 |  |  | Provide professional painting services for interior walls and ceilings, ensuring a fresh and clean finish. |
| Core Painting | Cabinet Refinishing and Full Painting for Kitchen Cabinets | DEFAULT_PAINT_SERVICE_26 |  | $0.00 | $600 | $2,500 | $4,425 |  |  | Refinish and fully paint kitchen cabinets for a fresh, updated look. |
| Core Painting | Interior Ceiling Painting with Sherwin Williams ProMar Products | DEFAULT_PAINT_SERVICE_27 |  | $0.00 | $476 | $1,200 | $3,600 |  |  | Apply high-quality Sherwin Williams ProMar interior latex paint to ceilings for a fresh and clean finish. |
| Core Painting | Interior Wall Painting for One-Bedroom Apartments | DEFAULT_PAINT_SERVICE_28 |  | $0.00 | $300 | $450 | $866 |  |  | Provide interior painting services for one-bedroom apartments, including walls and ceilings. |
| Core Painting | Interior Apartment Painting for Various Room Sizes | DEFAULT_PAINT_SERVICE_29 |  | $0.00 | $703 | $1,594 | $3,758 |  |  | Provide professional painting services for apartments, including walls, ceilings, and touch-ups in various room sizes. |
| Core Painting | Cabinet Painting and Refinishing for Residential Kitchens | DEFAULT_PAINT_SERVICE_30 |  | $0.00 | $2,160 | $3,746 | $5,537 |  |  | Professional painting and refinishing services for kitchen cabinets to enhance appearance and durability. |
| Exterior Components | Deck & Fence Painting / Staining | DEFAULT_PAINT_SERVICE_31 |  | $0.00 |  |  |  |  |  | Painting or staining of decks and fences to improve appearance and protect against weather and wear. |
| Exterior Components | Fascia & Soffit Painting | DEFAULT_PAINT_SERVICE_32 |  | $0.00 |  |  |  |  |  | Painting of fascia and soffits to protect roofline components and improve exterior appearance. |
| Exterior Components | Garage Door Painting | DEFAULT_PAINT_SERVICE_33 |  | $0.00 |  |  |  |  |  | Painting of garage doors to match or refresh exterior finishes and improve curb appeal. |
| Exterior Components | Exterior Painting and Staining for Residential Properties | DEFAULT_PAINT_SERVICE_34 |  | $0.00 | $950 | $1,541 | $2,862 |  |  | Provide exterior painting and staining services for decks, fences, and masonry surfaces. |
| Exterior Components | Exterior Painting of Residential Surfaces and Trim | DEFAULT_PAINT_SERVICE_35 |  | $0.00 | $2,100 | $4,500 | $6,500 |  |  | Professional painting services for exterior surfaces including siding, trim, and fences. |
| Prep & Repair | Surface Preparation | DEFAULT_PAINT_SERVICE_36 |  | $0.00 |  |  |  |  |  | Surface prep including cleaning, sanding, patching, and priming to ensure proper paint adhesion and a high-quality finish. |
| Prep & Repair | Drywall Patch & Repair | DEFAULT_PAINT_SERVICE_37 |  | $0.00 |  |  |  |  |  | Repair of minor drywall damage such as holes and cracks, creating a smooth surface ready for painting. |
| Prep & Repair | Caulking & Sealing | DEFAULT_PAINT_SERVICE_38 |  | $0.00 |  |  |  |  |  | Application of caulking to gaps and seams to improve finish quality and protect against moisture and air gaps. |
| Prep & Repair | Interior Painting and Preparation for Residential Rooms | DEFAULT_PAINT_SERVICE_39 |  | $0.00 | $800 | $1,650 | $3,400 |  |  | Complete preparation and painting of various interior rooms including kitchen, bathroom, living room, dining room, bedroom, and hallway. |
| Prep & Repair | Removal and Painting of Popcorn Ceilings in Interior Spaces | DEFAULT_PAINT_SERVICE_40 |  | $0.00 | $730 | $1,800 | $4,125 |  |  | Remove existing popcorn texture from ceilings and apply fresh paint for a clean finish. |

## Accountant

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Accountant > Accountant > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Accountant > Accountant > General request | Accountant - Book an appointment | DEFAULT_ACCOUNTANT_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Alternative Therapy

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Alternative therapy > Alternative therapy > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Alternative therapy > Alternative therapy > General request | Alternative therapy - Book an appointment | DEFAULT_ALTERNATIVE_THERAPY_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Appraisal

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Appraisal > Appraisal > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Appraisal > Appraisal > General request | Appraisal - Book an appointment | DEFAULT_APPRAISAL_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Audio & TV

- Services: **22** (22 with a task code, 0 without) in **6** categories (` > ` = nested subcategory): Audio & TV > Installation > TV & audio, Audio & TV > Installation > Smart home, Audio & TV > Installation > Other, Audio & TV > Repair > TV & audio, Audio & TV > Repair > Smart home, Audio & TV > Repair > Other
- Pricing insight available for 0 of 22 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Audio & TV > Installation > TV & audio | Installation - Complete audio-video system | DEFAULT_AUDIO_TV_SERVICE_1 |  | $200.00 |  |  |  |  |  | Expert audio-video system installation service |
| Audio & TV > Installation > TV & audio | Installation - TV installation | DEFAULT_AUDIO_TV_SERVICE_2 |  | $200.00 |  |  |  |  |  | Expert TV installation service |
| Audio & TV > Installation > TV & audio | Installation - Soundbar | DEFAULT_AUDIO_TV_SERVICE_3 |  | $200.00 |  |  |  |  |  | Expert soundbar installation service |
| Audio & TV > Installation > TV & audio | Installation - TV Mounting | DEFAULT_AUDIO_TV_SERVICE_4 |  | $200.00 |  |  |  |  |  | Expert TV mounting service |
| Audio & TV > Installation > TV & audio | Installation - Home theater system | DEFAULT_AUDIO_TV_SERVICE_5 |  | $200.00 |  |  |  |  |  | Expert home theater installation service |
| Audio & TV > Installation > TV & audio | Installation - Audio system | DEFAULT_AUDIO_TV_SERVICE_6 |  | $200.00 |  |  |  |  |  | Expert audio system installation service |
| Audio & TV > Installation > Smart home | Installation - Smart LED lighting | DEFAULT_AUDIO_TV_SERVICE_7 |  | $200.00 |  |  |  |  |  | Expert LED lighting installation service |
| Audio & TV > Installation > Smart home | Installation - Smart blinds / shades | DEFAULT_AUDIO_TV_SERVICE_8 |  | $200.00 |  |  |  |  |  | Expert smart blinds / shades installation service |
| Audio & TV > Installation > Smart home | Installation - Touch pad | DEFAULT_AUDIO_TV_SERVICE_9 |  | $200.00 |  |  |  |  |  | Expert touch pad installation service |
| Audio & TV > Installation > Smart home | Installation - Smart device | DEFAULT_AUDIO_TV_SERVICE_10 |  | $200.00 |  |  |  |  |  | Expert smart device installation service |
| Audio & TV > Installation > Other | Installation - Something else / I don't know | DEFAULT_AUDIO_TV_SERVICE_11 |  | $200.00 |  |  |  |  |  | Expert TV and audio installation service |
| Audio & TV > Repair > TV & audio | Repair - Complete audio-video system | DEFAULT_AUDIO_TV_SERVICE_12 |  | $200.00 |  |  |  |  |  | Expert TV and audio installation service |
| Audio & TV > Repair > TV & audio | Repair - TV installation | DEFAULT_AUDIO_TV_SERVICE_13 |  | $200.00 |  |  |  |  |  | Expert TV and audio installation service |
| Audio & TV > Repair > TV & audio | Repair - Soundbar | DEFAULT_AUDIO_TV_SERVICE_14 |  | $200.00 |  |  |  |  |  | Expert TV and audio installation service |
| Audio & TV > Repair > TV & audio | Repair - TV Mounting | DEFAULT_AUDIO_TV_SERVICE_15 |  | $200.00 |  |  |  |  |  | Expert TV and audio installation service |
| Audio & TV > Repair > TV & audio | Repair - Home theater system | DEFAULT_AUDIO_TV_SERVICE_16 |  | $200.00 |  |  |  |  |  | Expert TV and audio installation service |
| Audio & TV > Repair > TV & audio | Repair - Audio system | DEFAULT_AUDIO_TV_SERVICE_17 |  | $200.00 |  |  |  |  |  | Expert TV and audio installation service |
| Audio & TV > Repair > Smart home | Repair - Smart LED lighting | DEFAULT_AUDIO_TV_SERVICE_18 |  | $200.00 |  |  |  |  |  | Expert TV and audio installation service |
| Audio & TV > Repair > Smart home | Repair - Smart blinds / shades | DEFAULT_AUDIO_TV_SERVICE_19 |  | $200.00 |  |  |  |  |  | Expert TV and audio installation service |
| Audio & TV > Repair > Smart home | Repair - Touch pad | DEFAULT_AUDIO_TV_SERVICE_20 |  | $200.00 |  |  |  |  |  | Expert TV and audio installation service |
| Audio & TV > Repair > Smart home | Repair - Smart device | DEFAULT_AUDIO_TV_SERVICE_21 |  | $200.00 |  |  |  |  |  | Expert TV and audio installation service |
| Audio & TV > Repair > Other | Repair - Something else / I don't know | DEFAULT_AUDIO_TV_SERVICE_22 |  | $200.00 |  |  |  |  |  | Expert TV and audio installation service |

## Baby Proof

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Baby proof > Baby proof > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Baby proof > Baby proof > General request | Baby proof - Book an appointment | DEFAULT_BABYPROOF_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Barber

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Barber > Barber > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Barber > Barber > General request | Barber - Book an appointment | DEFAULT_BARBER_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Business Services

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Business services > Business services > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Business services > Business services > General request | Business services - Book an appointment | DEFAULT_BUSINESS_SERVICES_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Cabinetry

- Services: **7** (7 with a task code, 0 without) in **2** categories (` > ` = nested subcategory): Cabinetry > Installation > Doors & Cabinets, Cabinetry > Repair > Doors & Cabinets
- Pricing insight available for 4 of 7 services; median of medians **$202**

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Cabinetry > Installation > Doors & Cabinets | Installation - Cabinets | DEFAULT_CABINETRY_SERVICE_1 |  | $200.00 | $200 | $344 | $779 |  |  | Expert cabinets installation service |
| Cabinetry > Installation > Doors & Cabinets | Installation - Cabinet hardware | DEFAULT_CABINETRY_SERVICE_2 |  | $200.00 | $75 | $75 | $75 |  |  | Expert cabinet hardware installation service |
| Cabinetry > Installation > Doors & Cabinets | Installation - Something else / I don't know | DEFAULT_CABINETRY_SERVICE_3 |  | $200.00 |  |  |  |  |  | Expert cabinets installation service |
| Cabinetry > Repair > Doors & Cabinets | Repair - Refinishing cabinets | DEFAULT_CABINETRY_SERVICE_4 |  | $200.00 |  |  |  |  |  | Expert refinishing cabinets repair service |
| Cabinetry > Repair > Doors & Cabinets | Repair - Cabinets | DEFAULT_CABINETRY_SERVICE_5 |  | $200.00 | $125 | $216 | $376 |  |  | Expert cabinets repair service |
| Cabinetry > Repair > Doors & Cabinets | Repair - Cabinet hardware | DEFAULT_CABINETRY_SERVICE_6 |  | $200.00 | $85 | $189 | $304 |  |  | Expert cabinet hardware repair service |
| Cabinetry > Repair > Doors & Cabinets | Repair - Something else / I don't know | DEFAULT_CABINETRY_SERVICE_7 |  | $200.00 |  |  |  |  |  | Expert cabinets repair service |

## Carpet Repair

- Services: **2** (0 with a task code, 2 without) in **2** categories (` > ` = nested subcategory): Custom Services, Repair
- Pricing insight available for 0 of 2 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Custom Services | Custom Job |  |  | $0.00 |  |  |  |  | yes | Pro will provide you a quote if the work you need does not fit into one of our standard categories. / Please provide as much detail as possible, including pictures. |
| Repair | Carpet Stretching |  |  | $0.00 |  |  |  |  | yes | Does your carpet have wrinkles, ripples, and lumps? Are you tired of tripping on them? Do you wish that you could get rid of them right now? |

## Concrete & Asphalt

- Services: **51** (51 with a task code, 0 without) in **17** categories (` > ` = nested subcategory): Concrete & Asphalt > Installation > Asphalt, Concrete & Asphalt > Installation > Concrete, Concrete & Asphalt > Installation > Floor markings, Concrete & Asphalt > Installation > Parking lot, Concrete & Asphalt > Installation > Parking stops / curbs, Concrete & Asphalt > Installation > Piers, Concrete & Asphalt > Installation > Speed bumps, Concrete & Asphalt > Installation > Sports field markings, Concrete & Asphalt > Installation > Other, Concrete & Asphalt > Repair > Asphalt, Concrete & Asphalt > Repair > Concrete, Concrete & Asphalt > Repair > Concrete / foundation leveling, Concrete & Asphalt > Repair > Paint removal, Concrete & Asphalt > Repair > Parking stops / curbs, Concrete & Asphalt > Repair > Piers, Concrete & Asphalt > Repair > Speed bumps, Concrete & Asphalt > Repair > Other
- Pricing insight available for 0 of 51 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Concrete & Asphalt > Installation > Asphalt | Installation - Asphalt | DEFAULT_CONCRETE_SERVICE_1 |  | $1,200.00 |  |  |  |  |  | Expert asphalt service |
| Concrete & Asphalt > Installation > Concrete | Installation - Grinding | DEFAULT_CONCRETE_SERVICE_2 |  | $1,200.00 |  |  |  |  |  | Expert concrete installation service |
| Concrete & Asphalt > Installation > Concrete | Installation - Installation | DEFAULT_CONCRETE_SERVICE_3 |  | $1,200.00 |  |  |  |  |  | Expert concrete installation service |
| Concrete & Asphalt > Installation > Concrete | Installation - Staining | DEFAULT_CONCRETE_SERVICE_4 |  | $1,200.00 |  |  |  |  |  | Expert concrete installation service |
| Concrete & Asphalt > Installation > Concrete | Installation - Stamping | DEFAULT_CONCRETE_SERVICE_5 |  | $1,200.00 |  |  |  |  |  | Expert concrete installation service |
| Concrete & Asphalt > Installation > Floor markings | Installation - Image marking | DEFAULT_CONCRETE_SERVICE_6 |  | $1,200.00 |  |  |  |  |  | Expert floor marking service |
| Concrete & Asphalt > Installation > Floor markings | Installation - Line striping | DEFAULT_CONCRETE_SERVICE_7 |  | $1,200.00 |  |  |  |  |  | Expert floor marking service |
| Concrete & Asphalt > Installation > Parking lot | Installation - Image marking | DEFAULT_CONCRETE_SERVICE_8 |  | $1,200.00 |  |  |  |  |  | Expert floor marking service |
| Concrete & Asphalt > Installation > Parking lot | Installation - Line striping | DEFAULT_CONCRETE_SERVICE_9 |  | $1,200.00 |  |  |  |  |  | Expert floor marking service |
| Concrete & Asphalt > Installation > Parking lot | Installation - Sign | DEFAULT_CONCRETE_SERVICE_10 |  | $1,200.00 |  |  |  |  |  | Expert sign installation service |
| Concrete & Asphalt > Installation > Parking stops / curbs | Installation - Concrete parking stops / curbs | DEFAULT_CONCRETE_SERVICE_11 |  | $1,200.00 |  |  |  |  |  | Expert concrete installation service |
| Concrete & Asphalt > Installation > Parking stops / curbs | Installation - Rubberized wheel stops / curbs | DEFAULT_CONCRETE_SERVICE_12 |  | $1,200.00 |  |  |  |  |  | Expert concrete installation service |
| Concrete & Asphalt > Installation > Piers | Installation - Pressed piers | DEFAULT_CONCRETE_SERVICE_13 |  | $1,200.00 |  |  |  |  |  | Expert pier installation service |
| Concrete & Asphalt > Installation > Piers | Installation - Drilled piers | DEFAULT_CONCRETE_SERVICE_14 |  | $1,200.00 |  |  |  |  |  | Expert pier installation service |
| Concrete & Asphalt > Installation > Piers | Installation - Hybrid piers | DEFAULT_CONCRETE_SERVICE_15 |  | $1,200.00 |  |  |  |  |  | Expert pier installation service |
| Concrete & Asphalt > Installation > Piers | Installation - Pier and beam foundation | DEFAULT_CONCRETE_SERVICE_16 |  | $1,200.00 |  |  |  |  |  | Expert pier installation service |
| Concrete & Asphalt > Installation > Piers | Installation - Steel pier | DEFAULT_CONCRETE_SERVICE_17 |  | $1,200.00 |  |  |  |  |  | Expert pier installation service |
| Concrete & Asphalt > Installation > Speed bumps | Installation - Concrete speed bump | DEFAULT_CONCRETE_SERVICE_18 |  | $1,200.00 |  |  |  |  |  | Expert speed bump installation service |
| Concrete & Asphalt > Installation > Speed bumps | Installation - Rubberized speed bump | DEFAULT_CONCRETE_SERVICE_19 |  | $1,200.00 |  |  |  |  |  | Expert speed bump installation service |
| Concrete & Asphalt > Installation > Sports field markings | Installation - Image marking | DEFAULT_CONCRETE_SERVICE_20 |  | $1,200.00 |  |  |  |  |  | Expert floor marking service |
| Concrete & Asphalt > Installation > Sports field markings | Installation - Line striping | DEFAULT_CONCRETE_SERVICE_21 |  | $1,200.00 |  |  |  |  |  | Expert floor marking service |
| Concrete & Asphalt > Installation > Other | Installation - Epoxy Coating | DEFAULT_CONCRETE_SERVICE_22 |  | $1,200.00 |  |  |  |  |  | Expert epoxy/coating service |
| Concrete & Asphalt > Installation > Other | Installation - Root barriers | DEFAULT_CONCRETE_SERVICE_23 |  | $1,200.00 |  |  |  |  |  | Expert root barriers installation service |
| Concrete & Asphalt > Installation > Other | Installation - Delineators posts / parking pole | DEFAULT_CONCRETE_SERVICE_24 |  | $1,200.00 |  |  |  |  |  | Expert pole installation service |
| Concrete & Asphalt > Installation > Other | Installation - Something else / I don't know | DEFAULT_CONCRETE_SERVICE_25 |  | $1,200.00 |  |  |  |  |  | Expert concrete installation service |
| Concrete & Asphalt > Repair > Asphalt | Repair - Repair and patching | DEFAULT_CONCRETE_SERVICE_26 |  | $1,200.00 |  |  |  |  |  | Expert asphalt repair service |
| Concrete & Asphalt > Repair > Asphalt | Repair - Sealing | DEFAULT_CONCRETE_SERVICE_27 |  | $1,200.00 |  |  |  |  |  | Expert asphalt repair service |
| Concrete & Asphalt > Repair > Concrete | Repair - Repair and patching | DEFAULT_CONCRETE_SERVICE_28 |  | $1,200.00 |  |  |  |  |  | Expert concrete repair service |
| Concrete & Asphalt > Repair > Concrete | Repair - Sealing | DEFAULT_CONCRETE_SERVICE_29 |  | $1,200.00 |  |  |  |  |  | Expert concrete repair service |
| Concrete & Asphalt > Repair > Concrete / foundation leveling | Repair - Mud jacking | DEFAULT_CONCRETE_SERVICE_30 |  | $1,200.00 |  |  |  |  |  | Expert concrete repair service |
| Concrete & Asphalt > Repair > Concrete / foundation leveling | Repair - Pier / Screw / Support Jacks | DEFAULT_CONCRETE_SERVICE_31 |  | $1,200.00 |  |  |  |  |  | Expert concrete repair service |
| Concrete & Asphalt > Repair > Concrete / foundation leveling | Repair - Polyurethane Foam Injection | DEFAULT_CONCRETE_SERVICE_32 |  | $1,200.00 |  |  |  |  |  | Expert floor marking service |
| Concrete & Asphalt > Repair > Paint removal | Repair - Asphalt line removal | DEFAULT_CONCRETE_SERVICE_33 |  | $1,200.00 |  |  |  |  |  | Expert floor marking service |
| Concrete & Asphalt > Repair > Paint removal | Repair - Concrete line removal | DEFAULT_CONCRETE_SERVICE_34 |  | $1,200.00 |  |  |  |  |  | Expert floor marking service |
| Concrete & Asphalt > Repair > Parking stops / curbs | Repair - Concrete parking stops / curbs removal | DEFAULT_CONCRETE_SERVICE_35 |  | $1,200.00 |  |  |  |  |  | Expert floor marking service |
| Concrete & Asphalt > Repair > Parking stops / curbs | Repair - Concrete parking stops / curbs repair | DEFAULT_CONCRETE_SERVICE_36 |  | $1,200.00 |  |  |  |  |  | Expert sign repair service |
| Concrete & Asphalt > Repair > Parking stops / curbs | Repair - Rubberized wheel stops / curbs removal | DEFAULT_CONCRETE_SERVICE_37 |  | $1,200.00 |  |  |  |  |  | Expert concrete repair service |
| Concrete & Asphalt > Repair > Parking stops / curbs | Repair - Rubberized wheel stops / curbs repair | DEFAULT_CONCRETE_SERVICE_38 |  | $1,200.00 |  |  |  |  |  | Expert concrete repair service |
| Concrete & Asphalt > Repair > Piers | Repair - Pressed piers | DEFAULT_CONCRETE_SERVICE_39 |  | $1,200.00 |  |  |  |  |  | Expert pier repair service |
| Concrete & Asphalt > Repair > Piers | Repair - Drilled piers | DEFAULT_CONCRETE_SERVICE_40 |  | $1,200.00 |  |  |  |  |  | Expert pier repair service |
| Concrete & Asphalt > Repair > Piers | Repair - Hybrid piers | DEFAULT_CONCRETE_SERVICE_41 |  | $1,200.00 |  |  |  |  |  | Expert pier repair service |
| Concrete & Asphalt > Repair > Piers | Repair - Pier and beam foundation | DEFAULT_CONCRETE_SERVICE_42 |  | $1,200.00 |  |  |  |  |  | Expert pier repair service |
| Concrete & Asphalt > Repair > Piers | Repair - Steel pier | DEFAULT_CONCRETE_SERVICE_43 |  | $1,200.00 |  |  |  |  |  | Expert pier repair service |
| Concrete & Asphalt > Repair > Speed bumps | Repair - Concrete speed bump removal | DEFAULT_CONCRETE_SERVICE_44 |  | $1,200.00 |  |  |  |  |  | Expert speed bump repair service |
| Concrete & Asphalt > Repair > Speed bumps | Repair - Concrete speed bump repair | DEFAULT_CONCRETE_SERVICE_45 |  | $1,200.00 |  |  |  |  |  | Expert speed bump repair service |
| Concrete & Asphalt > Repair > Speed bumps | Repair - Rubberized speed bump removal | DEFAULT_CONCRETE_SERVICE_46 |  | $1,200.00 |  |  |  |  |  | Expert floor marking service |
| Concrete & Asphalt > Repair > Speed bumps | Repair - Rubberized speed bump repair | DEFAULT_CONCRETE_SERVICE_47 |  | $1,200.00 |  |  |  |  |  | Expert floor marking service |
| Concrete & Asphalt > Repair > Other | Repair - Epoxy Coating | DEFAULT_CONCRETE_SERVICE_48 |  | $1,200.00 |  |  |  |  |  | Expert epoxy/coating service |
| Concrete & Asphalt > Repair > Other | Repair - Delineators posts / parking pole | DEFAULT_CONCRETE_SERVICE_49 |  | $1,200.00 |  |  |  |  |  | Expert root barriers repair service |
| Concrete & Asphalt > Repair > Other | Repair - Root Barriers | DEFAULT_CONCRETE_SERVICE_50 |  | $1,200.00 |  |  |  |  |  | Expert pole repair service |
| Concrete & Asphalt > Repair > Other | Repair - Something else / I don't know | DEFAULT_CONCRETE_SERVICE_51 |  | $1,200.00 |  |  |  |  |  | Expert concrete repair service |

## Cooking

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Cooking > Cooking > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Cooking > Cooking > General request | Cooking - Book an appointment | DEFAULT_COOKING_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Credit Counselor

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Credit counselor > Credit counselor > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Credit counselor > Credit counselor > General request | Credit counselor - Book an appointment | DEFAULT_CREDIT_COUNSELOR_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Deck & Patio

- Services: **25** (25 with a task code, 0 without) in **8** categories (` > ` = nested subcategory): Deck & Patio > Installation > Driveway / patio, Deck & Patio > Installation > Decks and railings, Deck & Patio > Installation > Other, Deck & Patio > Repair > Driveway / patio, Deck & Patio > Repair > Decks and railings, Deck & Patio > Repair > Other, Deck & Patio > Maintenance > Decks and railings, Deck & Patio > Maintenance > Driveway / patio
- Pricing insight available for 0 of 25 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Deck & Patio > Installation > Driveway / patio | Installation - Pavers | DEFAULT_DECK_PATIO_SERVICE_1 |  | $1,000.00 |  |  |  |  |  | Expert pavers installation service |
| Deck & Patio > Installation > Driveway / patio | Installation - Blacktop | DEFAULT_DECK_PATIO_SERVICE_2 |  | $1,000.00 |  |  |  |  |  | Expert blacktop installation service |
| Deck & Patio > Installation > Driveway / patio | Installation - Coating / epoxy | DEFAULT_DECK_PATIO_SERVICE_3 |  | $1,000.00 |  |  |  |  |  | Expert coating / epoxy installation service |
| Deck & Patio > Installation > Driveway / patio | Installation - Concrete flooring | DEFAULT_DECK_PATIO_SERVICE_4 |  | $1,000.00 |  |  |  |  |  | Expert concrete flooring installation service |
| Deck & Patio > Installation > Driveway / patio | Installation - Tile flooring | DEFAULT_DECK_PATIO_SERVICE_5 |  | $1,000.00 |  |  |  |  |  | Expert tile flooring installation service |
| Deck & Patio > Installation > Driveway / patio | Installation - Wood flooring | DEFAULT_DECK_PATIO_SERVICE_6 |  | $1,000.00 |  |  |  |  |  | Expert wood flooring installation service |
| Deck & Patio > Installation > Decks and railings | Installation - Wood deck | DEFAULT_DECK_PATIO_SERVICE_7 |  | $1,000.00 |  |  |  |  |  | Expert wood deck installation service |
| Deck & Patio > Installation > Decks and railings | Installation - Composite deck | DEFAULT_DECK_PATIO_SERVICE_8 |  | $1,000.00 |  |  |  |  |  | Expert composite deck installation service |
| Deck & Patio > Installation > Decks and railings | Installation - Wood railing | DEFAULT_DECK_PATIO_SERVICE_9 |  | $1,000.00 |  |  |  |  |  | Expert wood railing installation service |
| Deck & Patio > Installation > Decks and railings | Installation - Composite railing | DEFAULT_DECK_PATIO_SERVICE_10 |  | $1,000.00 |  |  |  |  |  | Expert composite railing installation service |
| Deck & Patio > Installation > Other | Installation - Something else / I don't know | DEFAULT_DECK_PATIO_SERVICE_11 |  | $1,000.00 |  |  |  |  |  | Expert flooring service |
| Deck & Patio > Repair > Driveway / patio | Repair - Pavers | DEFAULT_DECK_PATIO_SERVICE_12 |  | $800.00 |  |  |  |  |  | Expert pavers repair service |
| Deck & Patio > Repair > Driveway / patio | Repair - Blacktop | DEFAULT_DECK_PATIO_SERVICE_13 |  | $800.00 |  |  |  |  |  | Expert blacktop repair service |
| Deck & Patio > Repair > Driveway / patio | Repair - Coating / epoxy | DEFAULT_DECK_PATIO_SERVICE_14 |  | $800.00 |  |  |  |  |  | Expert coating / epoxy repair service |
| Deck & Patio > Repair > Driveway / patio | Repair - Concrete flooring | DEFAULT_DECK_PATIO_SERVICE_15 |  | $800.00 |  |  |  |  |  | Expert concrete flooring repair service |
| Deck & Patio > Repair > Driveway / patio | Repair - Tile flooring | DEFAULT_DECK_PATIO_SERVICE_16 |  | $800.00 |  |  |  |  |  | Expert tile flooring repair service |
| Deck & Patio > Repair > Driveway / patio | Repair - Wood flooring | DEFAULT_DECK_PATIO_SERVICE_17 |  | $800.00 |  |  |  |  |  | Expert wood flooring repair service |
| Deck & Patio > Repair > Decks and railings | Repair - Wood deck | DEFAULT_DECK_PATIO_SERVICE_18 |  | $800.00 |  |  |  |  |  | Expert wood deck repair service |
| Deck & Patio > Repair > Decks and railings | Repair - Composite deck | DEFAULT_DECK_PATIO_SERVICE_19 |  | $800.00 |  |  |  |  |  | Expert composite deck repair service |
| Deck & Patio > Repair > Decks and railings | Repair - Wood railing | DEFAULT_DECK_PATIO_SERVICE_20 |  | $800.00 |  |  |  |  |  | Expert wood railing repair service |
| Deck & Patio > Repair > Decks and railings | Repair - Composite railing | DEFAULT_DECK_PATIO_SERVICE_21 |  | $800.00 |  |  |  |  |  | Expert composite railing repair service |
| Deck & Patio > Repair > Other | Repair - Something else / I don't know | DEFAULT_DECK_PATIO_SERVICE_22 |  | $800.00 |  |  |  |  |  | Expert something else / i don't know repair service |
| Deck & Patio > Maintenance > Decks and railings | Maintenance - Staining deck | DEFAULT_DECK_PATIO_SERVICE_23 |  | $150.00 |  |  |  |  |  | Expert deck staining maintenance service |
| Deck & Patio > Maintenance > Decks and railings | Maintenance - Sealing deck | DEFAULT_DECK_PATIO_SERVICE_24 |  | $150.00 |  |  |  |  |  | Expert deck staining maintenance service |
| Deck & Patio > Maintenance > Driveway / patio | Maintenance - Sealing driveway / patio | DEFAULT_DECK_PATIO_SERVICE_25 |  | $0.00 |  |  |  |  |  | Expert deck staining maintenance service |

## Demolition

- Services: **7** (7 with a task code, 0 without) in **2** categories (` > ` = nested subcategory): Demolition > Estimate > Demo / removal / cleanup, Demolition > Estimate > Other
- Pricing insight available for 0 of 7 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Demolition > Estimate > Demo / removal / cleanup | Estimate - Total demolition | DEFAULT_DEMOLITION_SERVICE_1 |  | $1,000.00 |  |  |  |  |  | Expert demolition service |
| Demolition > Estimate > Demo / removal / cleanup | Estimate - Partial demolition | DEFAULT_DEMOLITION_SERVICE_2 |  | $1,000.00 |  |  |  |  |  | Expert demolition service |
| Demolition > Estimate > Demo / removal / cleanup | Estimate - Strip out interior | DEFAULT_DEMOLITION_SERVICE_3 |  | $1,000.00 |  |  |  |  |  | Expert demolition service |
| Demolition > Estimate > Demo / removal / cleanup | Estimate - Asbestos abatement | DEFAULT_DEMOLITION_SERVICE_4 |  | $1,000.00 |  |  |  |  |  | Expert asbestos abatement service |
| Demolition > Estimate > Demo / removal / cleanup | Estimate - Environmental clean-up | DEFAULT_DEMOLITION_SERVICE_5 |  | $1,000.00 |  |  |  |  |  | Expert environmental cleanup service |
| Demolition > Estimate > Other | Estimate - Implosion | DEFAULT_DEMOLITION_SERVICE_6 |  | $1,000.00 |  |  |  |  |  | Expert implosion service |
| Demolition > Estimate > Other | Estimate - Something else / I don't know | DEFAULT_DEMOLITION_SERVICE_7 |  | $1,000.00 |  |  |  |  |  | Expert demolition service |

## Document Storage & Destruction

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Document storage & destruction > Document storage & destruction > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Document storage & destruction > Document storage & destruction > General request | Document storage & destruction - Book an appointment | DEFAULT_DOCUMENT_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Doors

- Services: **15** (15 with a task code, 0 without) in **6** categories (` > ` = nested subcategory): Doors > Installation > Doors, Doors > Installation > Hardware, Doors > Installation > Other, Doors > Repair > Doors, Doors > Repair > Hardware, Doors > Repair > Other
- Pricing insight available for 2 of 15 services; median of medians **$125**

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Doors > Installation > Doors | Installation - Interior door (install new only) | DEFAULT_DOORS_SERVICE_1 |  | $200.00 |  |  |  |  |  | Expert door installation service |
| Doors > Installation > Doors | Installation - Exterior door (install new only) | DEFAULT_DOORS_SERVICE_2 |  | $200.00 |  |  |  |  |  | Expert door installation service |
| Doors > Installation > Doors | Installation - Interior door (install new and replace old) | DEFAULT_DOORS_SERVICE_3 |  | $200.00 |  |  |  |  |  | Expert door installation service |
| Doors > Installation > Doors | Installation - Exterior door (install new and replace old) | DEFAULT_DOORS_SERVICE_4 |  | $200.00 |  |  |  |  |  | Expert door installation service |
| Doors > Installation > Hardware | Installation - Door hardware | DEFAULT_DOORS_SERVICE_5 |  | $200.00 |  |  |  |  |  | Expert door hardware installation service |
| Doors > Installation > Hardware | Installation - Smart locker | DEFAULT_DOORS_SERVICE_6 |  | $200.00 |  |  |  |  |  | Expert smart locker installation service |
| Doors > Installation > Other | Installation - Doorbell | DEFAULT_DOORS_SERVICE_7 |  | $200.00 | $100 | $150 | $236 |  |  | Expert doorbell installation service |
| Doors > Installation > Other | Installation - Something else / I don't know | DEFAULT_DOORS_SERVICE_8 |  | $200.00 |  |  |  |  |  | Expert door installation service |
| Doors > Repair > Doors | Repair - Door refinishing | DEFAULT_DOORS_SERVICE_9 |  | $200.00 |  |  |  |  |  | Expert door refinishing repair service |
| Doors > Repair > Doors | Repair - Interior door (install new and replace old) | DEFAULT_DOORS_SERVICE_10 |  | $200.00 |  |  |  |  |  | Expert door replacing service |
| Doors > Repair > Doors | Repair - Exterior door (install new and replace old) | DEFAULT_DOORS_SERVICE_11 |  | $200.00 |  |  |  |  |  | Expert door replacing service |
| Doors > Repair > Hardware | Repair - Door hardware | DEFAULT_DOORS_SERVICE_12 |  | $200.00 |  |  |  |  |  | Expert door hardware repair service |
| Doors > Repair > Hardware | Repair - Smart locker | DEFAULT_DOORS_SERVICE_13 |  | $200.00 |  |  |  |  |  | Expert smart locker repair service |
| Doors > Repair > Other | Repair - Doorbell | DEFAULT_DOORS_SERVICE_14 |  | $200.00 | $65 | $100 | $160 |  |  | Expert doorbell repair service |
| Doors > Repair > Other | Repair - Something else / I don't know | DEFAULT_DOORS_SERVICE_15 |  | $200.00 |  |  |  |  |  | Expert door repair service |

## Drywall

- Services: **8** (8 with a task code, 0 without) in **2** categories (` > ` = nested subcategory): Drywall > Installation > Construction, Drywall > Repair > Construction
- Pricing insight available for 1 of 8 services; median of medians **$650**

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Drywall > Installation > Construction | Installation - Drywall | DEFAULT_DRYWALL_SERVICE_1 |  | $150.00 |  |  |  |  |  | Expert drywall installation service |
| Drywall > Installation > Construction | Installation - Wallpaper | DEFAULT_DRYWALL_SERVICE_2 |  | $150.00 |  |  |  |  |  | Expert wallpaper installation service |
| Drywall > Installation > Construction | Installation - Wall painting | DEFAULT_DRYWALL_SERVICE_3 |  | $150.00 |  |  |  |  |  | Expert wall painting service |
| Drywall > Installation > Construction | Installation - Wall touch ups | DEFAULT_DRYWALL_SERVICE_4 |  | $150.00 |  |  |  |  |  | Expert wall touch ups service |
| Drywall > Repair > Construction | Repair - Drywall | DEFAULT_DRYWALL_SERVICE_5 |  | $150.00 | $275 | $650 | $1,280 |  |  | Expert drywall repair service |
| Drywall > Repair > Construction | Repair - Wallpaper (replace old) | DEFAULT_DRYWALL_SERVICE_6 |  | $150.00 |  |  |  |  |  | Expert wallpaper replacing service |
| Drywall > Repair > Construction | Repair - Wall painting | DEFAULT_DRYWALL_SERVICE_7 |  | $150.00 |  |  |  |  |  | Expert wall painting  service |
| Drywall > Repair > Construction | Repair - Wall touch ups | DEFAULT_DRYWALL_SERVICE_8 |  | $150.00 |  |  |  |  |  | Expert wall touch ups service |

## Fencing

- Services: **62** (62 with a task code, 0 without) in **8** categories (` > ` = nested subcategory): Fencing > Installation > Fencing, Fencing > Installation > Pool Fencing, Fencing > Installation > Railings, Fencing > Installation > Other, Fencing > Repair > Fencing, Fencing > Repair > Pool Fencing, Fencing > Repair > Railings, Fencing > Repair > Other
- Pricing insight available for 1 of 62 services; median of medians **$338**

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Fencing > Installation > Fencing | Installation - Aluminum fence | DEFAULT_FENCING_SERVICE_1 |  | $1,200.00 |  |  |  |  |  | Expert aluminum fence installation service |
| Fencing > Installation > Fencing | Installation - Barbed Wire | DEFAULT_FENCING_SERVICE_2 |  | $1,200.00 |  |  |  |  |  | Expert barbed wire installation service |
| Fencing > Installation > Fencing | Installation - Chain link fence | DEFAULT_FENCING_SERVICE_3 |  | $1,200.00 |  |  |  |  |  | Expert chain link fence installation service |
| Fencing > Installation > Fencing | Installation - Dog kennel fence | DEFAULT_FENCING_SERVICE_4 |  | $1,200.00 |  |  |  |  |  | Expert dog kennel fence installation service |
| Fencing > Installation > Fencing | Installation - Dog park fence | DEFAULT_FENCING_SERVICE_5 |  | $1,200.00 |  |  |  |  |  | Expert dog park fence installation service |
| Fencing > Installation > Fencing | Installation - Electric fence | DEFAULT_FENCING_SERVICE_6 |  | $1,200.00 |  |  |  |  |  | Expert electric fence installation service |
| Fencing > Installation > Fencing | Installation - Guardrail fence | DEFAULT_FENCING_SERVICE_7 |  | $1,200.00 |  |  |  |  |  | Expert guardrail fence installation service |
| Fencing > Installation > Fencing | Installation - Ornamental aluminum estate fence | DEFAULT_FENCING_SERVICE_8 |  | $1,200.00 |  |  |  |  |  | Expert ornamental aluminum estate fence installation service |
| Fencing > Installation > Fencing | Installation - PVC fence | DEFAULT_FENCING_SERVICE_9 |  | $1,200.00 |  |  |  |  |  | Expert pvc fence installation service |
| Fencing > Installation > Fencing | Installation - Retainage fence | DEFAULT_FENCING_SERVICE_10 |  | $1,200.00 |  |  |  |  |  | Expert retainage fence installation service |
| Fencing > Installation > Fencing | Installation - Solar field fence | DEFAULT_FENCING_SERVICE_11 |  | $1,200.00 |  |  |  |  |  | Expert solar field fence installation service |
| Fencing > Installation > Fencing | Installation - Split rail fence | DEFAULT_FENCING_SERVICE_12 |  | $1,200.00 |  |  |  |  |  | Expert split rail fence installation service |
| Fencing > Installation > Fencing | Installation - Steel fence | DEFAULT_FENCING_SERVICE_13 |  | $1,200.00 |  |  |  |  |  | Expert steel fence installation service |
| Fencing > Installation > Fencing | Installation - Stockade fence | DEFAULT_FENCING_SERVICE_14 |  | $1,200.00 |  |  |  |  |  | Expert stockade fence installation service |
| Fencing > Installation > Fencing | Installation - Temporary fence | DEFAULT_FENCING_SERVICE_15 |  | $1,200.00 |  |  |  |  |  | Expert temporary fence installation service |
| Fencing > Installation > Fencing | Installation - Vinyl fence | DEFAULT_FENCING_SERVICE_16 |  | $1,200.00 |  |  |  |  |  | Expert vinyl fence installation service |
| Fencing > Installation > Fencing | Installation - Water fence | DEFAULT_FENCING_SERVICE_17 |  | $1,200.00 |  |  |  |  |  | Expert water fence installation service |
| Fencing > Installation > Fencing | Installation - Wood fence | DEFAULT_FENCING_SERVICE_18 |  | $1,200.00 |  |  |  |  |  | Expert wood fence installation service |
| Fencing > Installation > Pool Fencing | Installation - Orange fence | DEFAULT_FENCING_SERVICE_19 |  | $1,200.00 |  |  |  |  |  | Expert orange fence installation service |
| Fencing > Installation > Pool Fencing | Installation - Temporary fence | DEFAULT_FENCING_SERVICE_20 |  | $1,200.00 |  |  |  |  |  | Expert temporary fence installation service |
| Fencing > Installation > Railings | Installation - Composite railing | DEFAULT_FENCING_SERVICE_21 |  | $1,200.00 |  |  |  |  |  | Expert composite railing installation service |
| Fencing > Installation > Railings | Installation - Metal railing | DEFAULT_FENCING_SERVICE_22 |  | $1,200.00 |  |  |  |  |  | Expert metal railing installation service |
| Fencing > Installation > Railings | Installation - PVC railings | DEFAULT_FENCING_SERVICE_23 |  | $1,200.00 |  |  |  |  |  | Expert pvc railings installation service |
| Fencing > Installation > Railings | Installation - Glass panels | DEFAULT_FENCING_SERVICE_24 |  | $1,200.00 |  |  |  |  |  | Expert glass panels installation service |
| Fencing > Installation > Railings | Installation - Cable railing | DEFAULT_FENCING_SERVICE_25 |  | $1,200.00 |  |  |  |  |  | Expert cable railing installation service |
| Fencing > Installation > Railings | Installation - Wood railing | DEFAULT_FENCING_SERVICE_26 |  | $1,200.00 |  |  |  |  |  | Expert wood railing installation service |
| Fencing > Installation > Other | Installation - Lamp post | DEFAULT_FENCING_SERVICE_27 |  | $1,200.00 |  |  |  |  |  | Expert lamp post installation service |
| Fencing > Installation > Other | Installation - Mailboxes | DEFAULT_FENCING_SERVICE_28 |  | $1,200.00 |  |  |  |  |  | Expert mailboxes installation service |
| Fencing > Installation > Other | Installation - Aluminum estate gates | DEFAULT_FENCING_SERVICE_29 |  | $1,200.00 |  |  |  |  |  | Expert aluminum estate gates installation service |
| Fencing > Installation > Other | Installation - Pergolas & Arbors | DEFAULT_FENCING_SERVICE_30 |  | $1,200.00 |  |  |  |  |  | Expert pergolas & arbors installation service |
| Fencing > Installation > Other | Installation - Something else / I don't know | DEFAULT_FENCING_SERVICE_31 |  | $1,200.00 |  |  |  |  |  | Expert fencing installation service |
| Fencing > Repair > Fencing | Repair - Aluminum fence | DEFAULT_FENCING_SERVICE_32 |  | $900.00 |  |  |  |  |  | Expert aluminum fence repair service |
| Fencing > Repair > Fencing | Repair - Barbed Wire | DEFAULT_FENCING_SERVICE_33 |  | $900.00 |  |  |  |  |  | Expert barbed wire repair service |
| Fencing > Repair > Fencing | Repair - Chain link fence | DEFAULT_FENCING_SERVICE_34 |  | $900.00 |  |  |  |  |  | Expert chain link fence repair service |
| Fencing > Repair > Fencing | Repair - Dog kennel fence | DEFAULT_FENCING_SERVICE_35 |  | $900.00 |  |  |  |  |  | Expert dog kennel fence repair service |
| Fencing > Repair > Fencing | Repair - Dog park fence | DEFAULT_FENCING_SERVICE_36 |  | $900.00 |  |  |  |  |  | Expert dog park fence repair service |
| Fencing > Repair > Fencing | Repair - Electric fence | DEFAULT_FENCING_SERVICE_37 |  | $900.00 |  |  |  |  |  | Expert electric fence repair service |
| Fencing > Repair > Fencing | Repair - Guardrail fence | DEFAULT_FENCING_SERVICE_38 |  | $900.00 |  |  |  |  |  | Expert guardrail fence repair service |
| Fencing > Repair > Fencing | Repair - Ornamental aluminum estate fence | DEFAULT_FENCING_SERVICE_39 |  | $900.00 |  |  |  |  |  | Expert ornamental aluminum estate fence repair service |
| Fencing > Repair > Fencing | Repair - PVC fence | DEFAULT_FENCING_SERVICE_40 |  | $900.00 |  |  |  |  |  | Expert pvc fence repair service |
| Fencing > Repair > Fencing | Repair - Retainage fence | DEFAULT_FENCING_SERVICE_41 |  | $900.00 |  |  |  |  |  | Expert retainage fence repair service |
| Fencing > Repair > Fencing | Repair - Solar field fence | DEFAULT_FENCING_SERVICE_42 |  | $900.00 |  |  |  |  |  | Expert solar field fence repair service |
| Fencing > Repair > Fencing | Repair - Split rail fence | DEFAULT_FENCING_SERVICE_43 |  | $900.00 |  |  |  |  |  | Expert split rail fence repair service |
| Fencing > Repair > Fencing | Repair - Steel fence | DEFAULT_FENCING_SERVICE_44 |  | $900.00 |  |  |  |  |  | Expert steel fence repair service |
| Fencing > Repair > Fencing | Repair - Stockade fence | DEFAULT_FENCING_SERVICE_45 |  | $900.00 |  |  |  |  |  | Expert stockade fence repair service |
| Fencing > Repair > Fencing | Repair - Temporary fence | DEFAULT_FENCING_SERVICE_46 |  | $900.00 |  |  |  |  |  | Expert temporary fence repair service |
| Fencing > Repair > Fencing | Repair - Vinyl fence | DEFAULT_FENCING_SERVICE_47 |  | $900.00 |  |  |  |  |  | Expert vinyl fence repair service |
| Fencing > Repair > Fencing | Repair - Water fence | DEFAULT_FENCING_SERVICE_48 |  | $900.00 |  |  |  |  |  | Expert water fence repair service |
| Fencing > Repair > Fencing | Repair - Wood fence | DEFAULT_FENCING_SERVICE_49 |  | $900.00 | $207 | $338 | $573 |  |  | Expert wood fence repair service |
| Fencing > Repair > Pool Fencing | Repair - Orange fence | DEFAULT_FENCING_SERVICE_50 |  | $900.00 |  |  |  |  |  | Expert orange fence repair service |
| Fencing > Repair > Pool Fencing | Repair - Temporary fence | DEFAULT_FENCING_SERVICE_51 |  | $900.00 |  |  |  |  |  | Expert temporary fence repair service |
| Fencing > Repair > Railings | Repair - Composite railing | DEFAULT_FENCING_SERVICE_52 |  | $900.00 |  |  |  |  |  | Expert composite railing repair service |
| Fencing > Repair > Railings | Repair - Metal railing | DEFAULT_FENCING_SERVICE_53 |  | $900.00 |  |  |  |  |  | Expert metal railing repair service |
| Fencing > Repair > Railings | Repair - PVC railings | DEFAULT_FENCING_SERVICE_54 |  | $900.00 |  |  |  |  |  | Expert pvc railings repair service |
| Fencing > Repair > Railings | Repair - Glass panels | DEFAULT_FENCING_SERVICE_55 |  | $900.00 |  |  |  |  |  | Expert glass panels repair service |
| Fencing > Repair > Railings | Repair - Cable railing | DEFAULT_FENCING_SERVICE_56 |  | $900.00 |  |  |  |  |  | Expert cable railing repair service |
| Fencing > Repair > Railings | Repair - Wood railing | DEFAULT_FENCING_SERVICE_57 |  | $900.00 |  |  |  |  |  | Expert wood railing repair service |
| Fencing > Repair > Other | Repair - Lamp post | DEFAULT_FENCING_SERVICE_58 |  | $900.00 |  |  |  |  |  | Expert lamp post repair service |
| Fencing > Repair > Other | Repair - Mailboxes | DEFAULT_FENCING_SERVICE_59 |  | $900.00 |  |  |  |  |  | Expert mailboxes repair service |
| Fencing > Repair > Other | Repair - Aluminum estate gates | DEFAULT_FENCING_SERVICE_60 |  | $900.00 |  |  |  |  |  | Expert aluminum estate gates repair service |
| Fencing > Repair > Other | Repair - Pergolas & Arbors | DEFAULT_FENCING_SERVICE_61 |  | $900.00 |  |  |  |  |  | Expert pergolas & arbors repair service |
| Fencing > Repair > Other | Repair - Something else / I don't know | DEFAULT_FENCING_SERVICE_62 |  | $900.00 |  |  |  |  |  | Expert fencing repair service |

## Financial Planner

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Financial planner > Financial planner > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Financial planner > Financial planner > General request | Financial planner - Book an appointment | DEFAULT_FINANCIAL_PLANNER_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Fireplace & Chimney

- Services: **80** (80 with a task code, 0 without) in **16** categories (` > ` = nested subcategory): Fireplace & Chimney > Installation > Chimney, Fireplace & Chimney > Installation > Chimney lining/liner systems, Fireplace & Chimney > Installation > Fireplace, Fireplace & Chimney > Installation > Outdoor , Fireplace & Chimney > Installation > Range and stove, Fireplace & Chimney > Installation > Other, Fireplace & Chimney > Repair > Chimney, Fireplace & Chimney > Repair > Chimney lining/liner systems, Fireplace & Chimney > Repair > Fireplace, Fireplace & Chimney > Repair > Fireplace/chimney tile breakouts, Fireplace & Chimney > Repair > Outdoor , Fireplace & Chimney > Repair > Range and stove, Fireplace & Chimney > Repair > Other, Fireplace & Chimney > Inspection > Chimney inspection and sweeps, Fireplace & Chimney > Inspection > Inspection, Fireplace & Chimney > Cleaning > Chimney
- Pricing insight available for 0 of 80 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Fireplace & Chimney > Installation > Chimney | Installation - Chimney caps | DEFAULT_FIREPLACE_SERVICE_1 |  | $300.00 |  |  |  |  |  | Expert chimney caps installation service |
| Fireplace & Chimney > Installation > Chimney | Installation - Damper | DEFAULT_FIREPLACE_SERVICE_2 |  | $300.00 |  |  |  |  |  | Expert damper installation service |
| Fireplace & Chimney > Installation > Chimney | Installation - Rain cap | DEFAULT_FIREPLACE_SERVICE_3 |  | $300.00 |  |  |  |  |  | Expert rain cap installation service |
| Fireplace & Chimney > Installation > Chimney | Installation - Vent | DEFAULT_FIREPLACE_SERVICE_4 |  | $300.00 |  |  |  |  |  | Expert vent installation service |
| Fireplace & Chimney > Installation > Chimney | Installation - Dryer vent (exterior vent/hole exists) | DEFAULT_FIREPLACE_SERVICE_5 |  | $300.00 |  |  |  |  |  | Expert dryer vent (exterior vent/hole exists) installation service |
| Fireplace & Chimney > Installation > Chimney | Installation - Dryer vent (no exterior vent/hole exists) | DEFAULT_FIREPLACE_SERVICE_6 |  | $300.00 |  |  |  |  |  | Expert dryer vent (no exterior vent/hole exists) installation service |
| Fireplace & Chimney > Installation > Chimney | Installation - Flue | DEFAULT_FIREPLACE_SERVICE_7 |  | $300.00 |  |  |  |  |  | Expert flue installation service |
| Fireplace & Chimney > Installation > Chimney | Installation - Insulation | DEFAULT_FIREPLACE_SERVICE_8 |  | $300.00 |  |  |  |  |  | Expert insulation installation service |
| Fireplace & Chimney > Installation > Chimney | Installation - Masonry chimney | DEFAULT_FIREPLACE_SERVICE_9 |  | $300.00 |  |  |  |  |  | Expert masonry chimney installation service |
| Fireplace & Chimney > Installation > Chimney | Installation - Animal trapping | DEFAULT_FIREPLACE_SERVICE_10 |  | $300.00 |  |  |  |  |  | Expert animal trapping service |
| Fireplace & Chimney > Installation > Chimney | Installation - Dryer vent (exterior vent/hole exists) | DEFAULT_FIREPLACE_SERVICE_11 |  | $300.00 |  |  |  |  |  | Expert dryer vent (exterior vent/hole exists) installation service |
| Fireplace & Chimney > Installation > Chimney | Installation - Dryer vent (no exterior vent/hole exists) | DEFAULT_FIREPLACE_SERVICE_12 |  | $300.00 |  |  |  |  |  | Expert dryer vent (no exterior vent/hole exists) installation service |
| Fireplace & Chimney > Installation > Chimney lining/liner systems | Installation - Insulated lining system  (no inspection Performed) | DEFAULT_FIREPLACE_SERVICE_13 |  | $300.00 |  |  |  |  |  | Expert insulated lining system  (no inspection performed) service |
| Fireplace & Chimney > Installation > Chimney lining/liner systems | Installation - Insulated lining system  (someone else performes the inspection) | DEFAULT_FIREPLACE_SERVICE_14 |  | $300.00 |  |  |  |  |  | Expert insulated lining system  (someone else performes the inspection) service |
| Fireplace & Chimney > Installation > Chimney lining/liner systems | Installation - Insulated lining system (we provide inspection) | DEFAULT_FIREPLACE_SERVICE_15 |  | $300.00 |  |  |  |  |  | Expert insulated lining system (we provide inspection) service |
| Fireplace & Chimney > Installation > Chimney lining/liner systems | Installation - Lining system - 25ft or less  (we provide inspection) | DEFAULT_FIREPLACE_SERVICE_16 |  | $300.00 |  |  |  |  |  | Expert lining system - 25ft or less  (we provide inspection) service |
| Fireplace & Chimney > Installation > Chimney lining/liner systems | Installation - Lining system - 25ft or less (no inspection performed) | DEFAULT_FIREPLACE_SERVICE_17 |  | $300.00 |  |  |  |  |  | Expert lining system - 25ft or less (no inspection performed) service |
| Fireplace & Chimney > Installation > Chimney lining/liner systems | Installation - Lining system - 25ft or less (someone else performes the inspection) | DEFAULT_FIREPLACE_SERVICE_18 |  | $300.00 |  |  |  |  |  | Expert lining system - 25ft or less (someone else performes the inspection) service |
| Fireplace & Chimney > Installation > Chimney lining/liner systems | Installation - Lining system - 3 story   (someone else performes the inspection) | DEFAULT_FIREPLACE_SERVICE_19 |  | $300.00 |  |  |  |  |  | Expert lining system - 3 story   (someone else performes the inspection) service |
| Fireplace & Chimney > Installation > Chimney lining/liner systems | Installation - Lining system - 3 story  (we provide inspection) | DEFAULT_FIREPLACE_SERVICE_20 |  | $300.00 |  |  |  |  |  | Expert lining system - 3 story  (we provide inspection) service |
| Fireplace & Chimney > Installation > Chimney lining/liner systems | Installation - Lining system - 3 story (no inspection Performed) | DEFAULT_FIREPLACE_SERVICE_21 |  | $300.00 |  |  |  |  |  | Expert lining system - 3 story (no inspection performed) service |
| Fireplace & Chimney > Installation > Fireplace | Installation - Electric fireplace | DEFAULT_FIREPLACE_SERVICE_22 |  | $300.00 |  |  |  |  |  | Expert electric fireplace installation service |
| Fireplace & Chimney > Installation > Fireplace | Installation - Gas fireplace | DEFAULT_FIREPLACE_SERVICE_23 |  | $300.00 |  |  |  |  |  | Expert gas fireplace installation service |
| Fireplace & Chimney > Installation > Fireplace | Installation - Wood burning fireplace | DEFAULT_FIREPLACE_SERVICE_24 |  | $300.00 |  |  |  |  |  | Expert wood burning fireplace installation service |
| Fireplace & Chimney > Installation > Outdoor  | Installation - Fire pit | DEFAULT_FIREPLACE_SERVICE_25 |  | $300.00 |  |  |  |  |  | Expert fire pit installation service |
| Fireplace & Chimney > Installation > Outdoor  | Installation - Fireplace | DEFAULT_FIREPLACE_SERVICE_26 |  | $300.00 |  |  |  |  |  | Expert fireplace installation service |
| Fireplace & Chimney > Installation > Range and stove | Installation - Range exhaust | DEFAULT_FIREPLACE_SERVICE_27 |  | $300.00 |  |  |  |  |  | Expert range exhaust installation service |
| Fireplace & Chimney > Installation > Range and stove | Installation - Pellet stove | DEFAULT_FIREPLACE_SERVICE_28 |  | $300.00 |  |  |  |  |  | Expert pellet stove installation service |
| Fireplace & Chimney > Installation > Range and stove | Installation - Stove | DEFAULT_FIREPLACE_SERVICE_29 |  | $300.00 |  |  |  |  |  | Expert stove installation service |
| Fireplace & Chimney > Installation > Range and stove | Installation - Wood stove | DEFAULT_FIREPLACE_SERVICE_30 |  | $300.00 |  |  |  |  |  | Expert wood stove installation service |
| Fireplace & Chimney > Installation > Other | Installation - Something else / I don't know | DEFAULT_FIREPLACE_SERVICE_31 |  | $300.00 |  |  |  |  |  | Expert chimney instalation service |
| Fireplace & Chimney > Repair > Chimney | Repair - Chimney caps | DEFAULT_FIREPLACE_SERVICE_32 |  | $350.00 |  |  |  |  |  | Expert chimney caps repair service |
| Fireplace & Chimney > Repair > Chimney | Repair - Chimney crown | DEFAULT_FIREPLACE_SERVICE_33 |  | $350.00 |  |  |  |  |  | Expert chimney crown repair service |
| Fireplace & Chimney > Repair > Chimney | Repair - Damper | DEFAULT_FIREPLACE_SERVICE_34 |  | $350.00 |  |  |  |  |  | Expert damper repair service |
| Fireplace & Chimney > Repair > Chimney | Repair - Rain cap | DEFAULT_FIREPLACE_SERVICE_35 |  | $350.00 |  |  |  |  |  | Expert rain cap repair service |
| Fireplace & Chimney > Repair > Chimney | Repair - Vent | DEFAULT_FIREPLACE_SERVICE_36 |  | $350.00 |  |  |  |  |  | Expert vent repair service |
| Fireplace & Chimney > Repair > Chimney | Repair - Flue | DEFAULT_FIREPLACE_SERVICE_37 |  | $350.00 |  |  |  |  |  | Expert flue repair service |
| Fireplace & Chimney > Repair > Chimney | Repair - Flashing | DEFAULT_FIREPLACE_SERVICE_38 |  | $350.00 |  |  |  |  |  | Expert flashing repair service |
| Fireplace & Chimney > Repair > Chimney | Repair - Insulation | DEFAULT_FIREPLACE_SERVICE_39 |  | $350.00 |  |  |  |  |  | Expert insulation repair service |
| Fireplace & Chimney > Repair > Chimney | Repair - Masonry chimney | DEFAULT_FIREPLACE_SERVICE_40 |  | $350.00 |  |  |  |  |  | Expert masonry chimney repair service |
| Fireplace & Chimney > Repair > Chimney | Repair - Animal trapping | DEFAULT_FIREPLACE_SERVICE_41 |  | $350.00 |  |  |  |  |  | Expert animal trapping repair service |
| Fireplace & Chimney > Repair > Chimney | Repair - Waterproofing | DEFAULT_FIREPLACE_SERVICE_42 |  | $350.00 |  |  |  |  |  | Expert waterproofing service |
| Fireplace & Chimney > Repair > Chimney | Repair - Smoke chamber parging | DEFAULT_FIREPLACE_SERVICE_43 |  | $350.00 |  |  |  |  |  | Expert smoke chamber parging service |
| Fireplace & Chimney > Repair > Chimney | Repair - Restoration | DEFAULT_FIREPLACE_SERVICE_44 |  | $350.00 |  |  |  |  |  | Expert restoration service |
| Fireplace & Chimney > Repair > Chimney | Repair - Rebuild | DEFAULT_FIREPLACE_SERVICE_45 |  | $350.00 |  |  |  |  |  | Expert rebuild service |
| Fireplace & Chimney > Repair > Chimney | Repair - Pointing | DEFAULT_FIREPLACE_SERVICE_46 |  | $350.00 |  |  |  |  |  | Expert pointing service |
| Fireplace & Chimney > Repair > Chimney lining/liner systems | Repair - Re-lining | DEFAULT_FIREPLACE_SERVICE_47 |  | $350.00 |  |  |  |  |  | Expert re-lining service |
| Fireplace & Chimney > Repair > Fireplace | Repair - Electric  | DEFAULT_FIREPLACE_SERVICE_48 |  | $350.00 |  |  |  |  |  | Expert electric  repair service |
| Fireplace & Chimney > Repair > Fireplace | Repair - Electric fireplace | DEFAULT_FIREPLACE_SERVICE_49 |  | $350.00 |  |  |  |  |  | Expert electric fireplace repair service |
| Fireplace & Chimney > Repair > Fireplace | Repair - Gas fireplace | DEFAULT_FIREPLACE_SERVICE_50 |  | $350.00 |  |  |  |  |  | Expert gas fireplace repair service |
| Fireplace & Chimney > Repair > Fireplace | Repair - Wood burning fireplace | DEFAULT_FIREPLACE_SERVICE_51 |  | $350.00 |  |  |  |  |  | Expert wood burning fireplace repair service |
| Fireplace & Chimney > Repair > Fireplace/chimney tile breakouts | Repair - Fireplace tile breakout | DEFAULT_FIREPLACE_SERVICE_52 |  | $350.00 |  |  |  |  |  | Expert fireplace tile breakout repair service |
| Fireplace & Chimney > Repair > Fireplace/chimney tile breakouts | Repair - Terra cotta tile breakout  | DEFAULT_FIREPLACE_SERVICE_53 |  | $350.00 |  |  |  |  |  | Expert terra cotta tile breakout  repair service |
| Fireplace & Chimney > Repair > Outdoor  | Repair - Fire pit | DEFAULT_FIREPLACE_SERVICE_54 |  | $350.00 |  |  |  |  |  | Expert fire pit repair service |
| Fireplace & Chimney > Repair > Outdoor  | Repair - Fireplace | DEFAULT_FIREPLACE_SERVICE_55 |  | $350.00 |  |  |  |  |  | Expert fireplace repair service |
| Fireplace & Chimney > Repair > Range and stove | Repair - Range Exhaust | DEFAULT_FIREPLACE_SERVICE_56 |  | $350.00 |  |  |  |  |  | Expert range exhaust repair service |
| Fireplace & Chimney > Repair > Range and stove | Repair - Pellet stove | DEFAULT_FIREPLACE_SERVICE_57 |  | $350.00 |  |  |  |  |  | Expert pellet stove repair service |
| Fireplace & Chimney > Repair > Range and stove | Repair - Stove | DEFAULT_FIREPLACE_SERVICE_58 |  | $350.00 |  |  |  |  |  | Expert stove repair service |
| Fireplace & Chimney > Repair > Range and stove | Repair - Wood stove | DEFAULT_FIREPLACE_SERVICE_59 |  | $350.00 |  |  |  |  |  | Expert wood stove repair service |
| Fireplace & Chimney > Repair > Other | Repair - Something else / I don't know | DEFAULT_FIREPLACE_SERVICE_60 |  | $350.00 |  |  |  |  |  | Expert chimney repair service |
| Fireplace & Chimney > Inspection > Chimney inspection and sweeps | Inspection - Single flue inspection | DEFAULT_FIREPLACE_SERVICE_61 |  | $250.00 |  |  |  |  |  | Expert chimney inspection and sweeps service |
| Fireplace & Chimney > Inspection > Chimney inspection and sweeps | Inspection - Single flue inspection + Sweep | DEFAULT_FIREPLACE_SERVICE_62 |  | $250.00 |  |  |  |  |  | Expert chimney inspection and sweeps service |
| Fireplace & Chimney > Inspection > Chimney inspection and sweeps | Inspection - Double Flue Inspection | DEFAULT_FIREPLACE_SERVICE_63 |  | $250.00 |  |  |  |  |  | Expert chimney inspection and sweeps service |
| Fireplace & Chimney > Inspection > Chimney inspection and sweeps | Inspection - Double Flue Inspection + 1 Sweep | DEFAULT_FIREPLACE_SERVICE_64 |  | $250.00 |  |  |  |  |  | Expert chimney inspection and sweeps service |
| Fireplace & Chimney > Inspection > Chimney inspection and sweeps | Inspection - Double Flue Inspection + 2 Sweeps | DEFAULT_FIREPLACE_SERVICE_65 |  | $250.00 |  |  |  |  |  | Expert chimney inspection and sweeps service |
| Fireplace & Chimney > Inspection > Chimney inspection and sweeps | Inspection - Triple Flue Inspection | DEFAULT_FIREPLACE_SERVICE_66 |  | $250.00 |  |  |  |  |  | Expert chimney inspection and sweeps service |
| Fireplace & Chimney > Inspection > Chimney inspection and sweeps | Inspection - Triple Flue Inspection + 1 Sweep | DEFAULT_FIREPLACE_SERVICE_67 |  | $250.00 |  |  |  |  |  | Expert chimney inspection and sweeps service |
| Fireplace & Chimney > Inspection > Chimney inspection and sweeps | Inspection - Triple Flue Inspection + 2 Sweeps | DEFAULT_FIREPLACE_SERVICE_68 |  | $250.00 |  |  |  |  |  | Expert chimney inspection and sweeps service |
| Fireplace & Chimney > Inspection > Chimney inspection and sweeps | Inspection - Triple Flue Inspection + 3 Sweeps | DEFAULT_FIREPLACE_SERVICE_69 |  | $250.00 |  |  |  |  |  | Expert chimney inspection and sweeps service |
| Fireplace & Chimney > Inspection > Chimney inspection and sweeps | Inspection - Quadruple Flue Inspection | DEFAULT_FIREPLACE_SERVICE_70 |  | $250.00 |  |  |  |  |  | Expert chimney inspection and sweeps service |
| Fireplace & Chimney > Inspection > Chimney inspection and sweeps | Inspection - Quadruple Flue Inspection + 1 Sweep | DEFAULT_FIREPLACE_SERVICE_71 |  | $250.00 |  |  |  |  |  | Expert chimney inspection and sweeps service |
| Fireplace & Chimney > Inspection > Chimney inspection and sweeps | Inspection - Quadruple Flue Inspection + 2 Sweeps | DEFAULT_FIREPLACE_SERVICE_72 |  | $250.00 |  |  |  |  |  | Expert chimney inspection and sweeps service |
| Fireplace & Chimney > Inspection > Chimney inspection and sweeps | Inspection - Quadruple Flue Inspection + 3 Sweeps | DEFAULT_FIREPLACE_SERVICE_73 |  | $250.00 |  |  |  |  |  | Expert chimney inspection and sweeps service |
| Fireplace & Chimney > Inspection > Chimney inspection and sweeps | Inspection - Quadruple Flue Inspection + 4 Sweeps | DEFAULT_FIREPLACE_SERVICE_74 |  | $250.00 |  |  |  |  |  | Expert chimney inspection and sweeps service |
| Fireplace & Chimney > Inspection > Inspection | Inspection - Home Owner Inspections (Level I) | DEFAULT_FIREPLACE_SERVICE_75 |  | $250.00 |  |  |  |  |  | Expert home owner inspections (level i) service |
| Fireplace & Chimney > Inspection > Inspection | Inspection - Real Estate Inspections (Level II) | DEFAULT_FIREPLACE_SERVICE_76 |  | $250.00 |  |  |  |  |  | Expert real estate inspections (level ii) service |
| Fireplace & Chimney > Inspection > Inspection | Inspection - Video Inspections | DEFAULT_FIREPLACE_SERVICE_77 |  | $250.00 |  |  |  |  |  | Expert video inspections service |
| Fireplace & Chimney > Cleaning > Chimney | Cleaning - PCR (chemical) cleaning | DEFAULT_FIREPLACE_SERVICE_78 |  | $200.00 |  |  |  |  |  | Expert pcr (chemical) cleaning service |
| Fireplace & Chimney > Cleaning > Chimney | Cleaning - Dryer vent cleaning | DEFAULT_FIREPLACE_SERVICE_79 |  | $200.00 |  |  |  |  |  | Expert dryer vent cleaning service |
| Fireplace & Chimney > Cleaning > Chimney | Cleaning - Sweeping | DEFAULT_FIREPLACE_SERVICE_80 |  | $200.00 |  |  |  |  |  | Expert sweeping service |

## Fitness

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Fitness > Fitness > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Fitness > Fitness > General request | Fitness - Book an appointment | DEFAULT_PERSONAL_TRAINER_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Fleets & Trucks

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Fleets & trucks > Fleets & trucks > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Fleets & trucks > Fleets & trucks > General request | Fleets & trucks - Book an appointment | DEFAULT_FLEET_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Flooring

- Services: **70** (70 with a task code, 0 without) in **12** categories (` > ` = nested subcategory): Flooring > Installation > Basement, Flooring > Installation > Driveway, Flooring > Installation > Garage, Flooring > Installation > Interior, Flooring > Installation > Exterior, Flooring > Installation > Other, Flooring > Repair > Basement, Flooring > Repair > Driveway, Flooring > Repair > Garage, Flooring > Repair > Interior, Flooring > Repair > Exterior, Flooring > Repair > Other
- Pricing insight available for 0 of 70 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Flooring > Installation > Basement | Installation - Carpet | DEFAULT_FLOORING_SERVICE_1 |  | $1,000.00 |  |  |  |  |  | Expert carpet installation service |
| Flooring > Installation > Basement | Installation - Coating / epoxy | DEFAULT_FLOORING_SERVICE_2 |  | $1,000.00 |  |  |  |  |  | Expert coating / epoxy flooring service |
| Flooring > Installation > Basement | Installation - Concrete | DEFAULT_FLOORING_SERVICE_3 |  | $1,000.00 |  |  |  |  |  | Expert concrete flooring service |
| Flooring > Installation > Basement | Installation - Engineered wood flooring | DEFAULT_FLOORING_SERVICE_4 |  | $1,000.00 |  |  |  |  |  | Expert engineered wood flooring installation service |
| Flooring > Installation > Basement | Installation - Sub floor | DEFAULT_FLOORING_SERVICE_5 |  | $1,000.00 |  |  |  |  |  | Expert sub floor installation service |
| Flooring > Installation > Basement | Installation - Tile | DEFAULT_FLOORING_SERVICE_6 |  | $1,000.00 |  |  |  |  |  | Expert tile flooring installation service |
| Flooring > Installation > Basement | Installation - Vinly | DEFAULT_FLOORING_SERVICE_7 |  | $1,000.00 |  |  |  |  |  | Expert vinly flooring installation service |
| Flooring > Installation > Basement | Installation - Wood | DEFAULT_FLOORING_SERVICE_8 |  | $1,000.00 |  |  |  |  |  | Expert wood flooring installation service |
| Flooring > Installation > Driveway | Installation - Pavers | DEFAULT_FLOORING_SERVICE_9 |  | $1,000.00 |  |  |  |  |  | Expert pavers installation service |
| Flooring > Installation > Driveway | Installation - Blacktop | DEFAULT_FLOORING_SERVICE_10 |  | $1,000.00 |  |  |  |  |  | Expert blacktop installation service |
| Flooring > Installation > Driveway | Installation - Coating / epoxy | DEFAULT_FLOORING_SERVICE_11 |  | $1,000.00 |  |  |  |  |  | Expert coating / epoxy installation service |
| Flooring > Installation > Driveway | Installation - Concrete | DEFAULT_FLOORING_SERVICE_12 |  | $1,000.00 |  |  |  |  |  | Expert concrete installation service |
| Flooring > Installation > Garage | Installation - Coating / epoxy | DEFAULT_FLOORING_SERVICE_13 |  | $1,000.00 |  |  |  |  |  | Expert coating / epoxy installation service |
| Flooring > Installation > Garage | Installation - Concrete | DEFAULT_FLOORING_SERVICE_14 |  | $1,000.00 |  |  |  |  |  | Expert concrete installation service |
| Flooring > Installation > Garage | Installation - Tile | DEFAULT_FLOORING_SERVICE_15 |  | $1,000.00 |  |  |  |  |  | Expert tile flooring installation service |
| Flooring > Installation > Interior | Installation - Carpet | DEFAULT_FLOORING_SERVICE_16 |  | $1,000.00 |  |  |  |  |  | Expert carpet installation service |
| Flooring > Installation > Interior | Installation - Coating / epoxy | DEFAULT_FLOORING_SERVICE_17 |  | $1,000.00 |  |  |  |  |  | Expert coating / epoxy installation service |
| Flooring > Installation > Interior | Installation - Concrete | DEFAULT_FLOORING_SERVICE_18 |  | $1,000.00 |  |  |  |  |  | Expert concrete installation service |
| Flooring > Installation > Interior | Installation - Engineered wood flooring | DEFAULT_FLOORING_SERVICE_19 |  | $1,000.00 |  |  |  |  |  | Expert engineered wood flooring installation service |
| Flooring > Installation > Interior | Installation - Sub floor | DEFAULT_FLOORING_SERVICE_20 |  | $1,000.00 |  |  |  |  |  | Expert sub floor installation service |
| Flooring > Installation > Interior | Installation - Tile | DEFAULT_FLOORING_SERVICE_21 |  | $1,000.00 |  |  |  |  |  | Expert tile flooring installation service |
| Flooring > Installation > Interior | Installation - Vinly | DEFAULT_FLOORING_SERVICE_22 |  | $1,000.00 |  |  |  |  |  | Expert vinly flooring installation service |
| Flooring > Installation > Interior | Installation - Wood | DEFAULT_FLOORING_SERVICE_23 |  | $1,000.00 |  |  |  |  |  | Expert wood  flooring installation service |
| Flooring > Installation > Exterior | Installation - Coating / epoxy | DEFAULT_FLOORING_SERVICE_24 |  | $1,000.00 |  |  |  |  |  | Expert coating / epoxy  installation service |
| Flooring > Installation > Exterior | Installation - Concrete | DEFAULT_FLOORING_SERVICE_25 |  | $1,000.00 |  |  |  |  |  | Expert concrete installation service |
| Flooring > Installation > Exterior | Installation - Wood deck | DEFAULT_FLOORING_SERVICE_26 |  | $1,000.00 |  |  |  |  |  | Expert wood deck installation service |
| Flooring > Installation > Exterior | Installation - Composite deck | DEFAULT_FLOORING_SERVICE_27 |  | $1,000.00 |  |  |  |  |  | Expert composite deck installation service |
| Flooring > Installation > Exterior | Installation - Tile | DEFAULT_FLOORING_SERVICE_28 |  | $1,000.00 |  |  |  |  |  | Expert tile flooring installation service |
| Flooring > Installation > Exterior | Installation - Wood | DEFAULT_FLOORING_SERVICE_29 |  | $1,000.00 |  |  |  |  |  | Expert wood flooring installation service |
| Flooring > Installation > Other | Installation - Something else / I don't know | DEFAULT_FLOORING_SERVICE_30 |  | $1,000.00 |  |  |  |  |  | Expert flooring service |
| Flooring > Repair > Basement | Repair - Carpet | DEFAULT_FLOORING_SERVICE_31 |  | $800.00 |  |  |  |  |  | Expert carpet repair service |
| Flooring > Repair > Basement | Repair - Carpet stretching | DEFAULT_FLOORING_SERVICE_32 |  | $800.00 |  |  |  |  |  | Expert carpet stretching repair service |
| Flooring > Repair > Basement | Repair - Coating / epoxy | DEFAULT_FLOORING_SERVICE_33 |  | $800.00 |  |  |  |  |  | Expert coating / epoxy repair service |
| Flooring > Repair > Basement | Repair - Concrete re-pouring | DEFAULT_FLOORING_SERVICE_34 |  | $800.00 |  |  |  |  |  | Expert concrete re-pouring repair service |
| Flooring > Repair > Basement | Repair - Concrete removal | DEFAULT_FLOORING_SERVICE_35 |  | $800.00 |  |  |  |  |  | Expert concrete removal service |
| Flooring > Repair > Basement | Repair - Engineered wood flooring | DEFAULT_FLOORING_SERVICE_36 |  | $800.00 |  |  |  |  |  | Expert engineered wood flooring repair service |
| Flooring > Repair > Basement | Repair - Sub floor | DEFAULT_FLOORING_SERVICE_37 |  | $800.00 |  |  |  |  |  | Expert sub floor repair service |
| Flooring > Repair > Basement | Repair - Tile | DEFAULT_FLOORING_SERVICE_38 |  | $800.00 |  |  |  |  |  | Expert tile flooring repair service |
| Flooring > Repair > Basement | Repair - Vinly | DEFAULT_FLOORING_SERVICE_39 |  | $800.00 |  |  |  |  |  | Expert vinly flooring repair service |
| Flooring > Repair > Basement | Repair - Wood | DEFAULT_FLOORING_SERVICE_40 |  | $800.00 |  |  |  |  |  | Expert wood flooring repair service |
| Flooring > Repair > Basement | Repair - Concrete polishing | DEFAULT_FLOORING_SERVICE_41 |  | $800.00 |  |  |  |  |  | Expert concrete polishing service |
| Flooring > Repair > Basement | Repair - Concrete sealing | DEFAULT_FLOORING_SERVICE_42 |  | $800.00 |  |  |  |  |  | Expert concrete sealing service |
| Flooring > Repair > Driveway | Repair - Pavers | DEFAULT_FLOORING_SERVICE_43 |  | $800.00 |  |  |  |  |  | Expert pavers repair service |
| Flooring > Repair > Driveway | Repair - Blacktop | DEFAULT_FLOORING_SERVICE_44 |  | $800.00 |  |  |  |  |  | Expert blacktop repair service |
| Flooring > Repair > Driveway | Repair - Coating / epoxy | DEFAULT_FLOORING_SERVICE_45 |  | $800.00 |  |  |  |  |  | Expert coating / epoxy repair service |
| Flooring > Repair > Driveway | Repair - Concrete polishing | DEFAULT_FLOORING_SERVICE_46 |  | $800.00 |  |  |  |  |  | Expert concrete polishing service |
| Flooring > Repair > Driveway | Repair - Concrete re-pouring | DEFAULT_FLOORING_SERVICE_47 |  | $800.00 |  |  |  |  |  | Expert concrete re-pouring service |
| Flooring > Repair > Driveway | Repair - Concrete sealing | DEFAULT_FLOORING_SERVICE_48 |  | $800.00 |  |  |  |  |  | Expert concrete sealing service |
| Flooring > Repair > Garage | Repair - Coating / epoxy | DEFAULT_FLOORING_SERVICE_49 |  | $800.00 |  |  |  |  |  | Expert coating / epoxy repair service |
| Flooring > Repair > Garage | Repair - Concrete re-pouring | DEFAULT_FLOORING_SERVICE_50 |  | $800.00 |  |  |  |  |  | Expert concrete re-pouring service |
| Flooring > Repair > Garage | Repair - Tile | DEFAULT_FLOORING_SERVICE_51 |  | $800.00 |  |  |  |  |  | Expert tile flooring repair service |
| Flooring > Repair > Garage | Repair - Concrete Sealing | DEFAULT_FLOORING_SERVICE_52 |  | $800.00 |  |  |  |  |  | Expert concrete sealing service |
| Flooring > Repair > Interior | Repair - Carpet | DEFAULT_FLOORING_SERVICE_53 |  | $800.00 |  |  |  |  |  | Expert carpet repair service |
| Flooring > Repair > Interior | Repair - Carpet stretching | DEFAULT_FLOORING_SERVICE_54 |  | $800.00 |  |  |  |  |  | Expert carpet stretching repair service |
| Flooring > Repair > Interior | Repair - Coating / epoxy | DEFAULT_FLOORING_SERVICE_55 |  | $800.00 |  |  |  |  |  | Expert coating / epoxy repair service |
| Flooring > Repair > Interior | Repair - Concrete re-pouring | DEFAULT_FLOORING_SERVICE_56 |  | $800.00 |  |  |  |  |  | Expert concrete re-pouring repair service |
| Flooring > Repair > Interior | Repair - Engineered wood flooring | DEFAULT_FLOORING_SERVICE_57 |  | $800.00 |  |  |  |  |  | Expert engineered wood flooring  repair service |
| Flooring > Repair > Interior | Repair - Sub floor | DEFAULT_FLOORING_SERVICE_58 |  | $800.00 |  |  |  |  |  | Expert sub floor repair service |
| Flooring > Repair > Interior | Repair - Tile | DEFAULT_FLOORING_SERVICE_59 |  | $800.00 |  |  |  |  |  | Expert tile flooring repair service |
| Flooring > Repair > Interior | Repair - Vinly | DEFAULT_FLOORING_SERVICE_60 |  | $800.00 |  |  |  |  |  | Expert vinly flooring repair service |
| Flooring > Repair > Interior | Repair - Wood | DEFAULT_FLOORING_SERVICE_61 |  | $800.00 |  |  |  |  |  | Expert wood  flooring repair service |
| Flooring > Repair > Interior | Repair - Concrete Sealing | DEFAULT_FLOORING_SERVICE_62 |  | $800.00 |  |  |  |  |  | Expert concrete sealing repair service |
| Flooring > Repair > Exterior | Repair - Coating / epoxy | DEFAULT_FLOORING_SERVICE_63 |  | $800.00 |  |  |  |  |  | Expert coating / epoxy  repair service |
| Flooring > Repair > Exterior | Repair - Concrete | DEFAULT_FLOORING_SERVICE_64 |  | $800.00 |  |  |  |  |  | Expert concrete repair service |
| Flooring > Repair > Exterior | Repair - Wood deck | DEFAULT_FLOORING_SERVICE_65 |  | $800.00 |  |  |  |  |  | Expert wood deck repair service |
| Flooring > Repair > Exterior | Repair - Composite deck | DEFAULT_FLOORING_SERVICE_66 |  | $800.00 |  |  |  |  |  | Expert composite deck repair service |
| Flooring > Repair > Exterior | Repair - Tile | DEFAULT_FLOORING_SERVICE_67 |  | $800.00 |  |  |  |  |  | Expert tile flooring repair service |
| Flooring > Repair > Exterior | Repair - Wood | DEFAULT_FLOORING_SERVICE_68 |  | $800.00 |  |  |  |  |  | Expert wood flooring repair service |
| Flooring > Repair > Exterior | Repair - Concrete sealing | DEFAULT_FLOORING_SERVICE_69 |  | $800.00 |  |  |  |  |  | Expert concrete sealing service |
| Flooring > Repair > Other | Repair - Something else / I don't know | DEFAULT_FLOORING_SERVICE_70 |  | $800.00 |  |  |  |  |  | Expert flooring service |

## Furniture & Upholstery

- Services: **1** (0 with a task code, 1 without) in **1** category (` > ` = nested subcategory): Custom Services
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Custom Services | Custom Job |  |  | $0.00 |  |  |  |  | yes | Pro will provide you a quote if the work you need does not fit into one of our standard categories. / Please provide as much detail as possible, including pictures. |

## Glass

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Glass > Glass > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Glass > Glass > General request | Glass - Book an appointment | DEFAULT_GLASS_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Graphics & Printing

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Graphics & printing > Graphics & printing > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Graphics & printing > Graphics & printing > General request | Graphics & printing - Book an appointment | DEFAULT_GRAPHICS_PRINTING_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Gutters

- Services: **33** (33 with a task code, 0 without) in **8** categories (` > ` = nested subcategory): Gutters > Installation > Gutters and downspouts, Gutters > Installation > Drainage, Gutters > Installation > Other, Gutters > Maintenance > Gutters and downspouts, Gutters > Maintenance > Other, Gutters > Repair > Gutters and downspouts, Gutters > Repair > Drainage, Gutters > Repair > Other
- Pricing insight available for 0 of 33 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Gutters > Installation > Gutters and downspouts | Installation - Regular gutters | DEFAULT_GUTTERS_SERVICE_1 |  | $400.00 |  |  |  |  |  | Expert gutter intallation service |
| Gutters > Installation > Gutters and downspouts | Installation - Seamless gutters | DEFAULT_GUTTERS_SERVICE_2 |  | $400.00 |  |  |  |  |  | Expert gutter intallation service |
| Gutters > Installation > Gutters and downspouts | Installation - Downspouts | DEFAULT_GUTTERS_SERVICE_3 |  | $400.00 |  |  |  |  |  | Expert gutter intallation service |
| Gutters > Installation > Gutters and downspouts | Installation - Box gutter | DEFAULT_GUTTERS_SERVICE_4 |  | $400.00 |  |  |  |  |  | Expert gutter intallation service |
| Gutters > Installation > Gutters and downspouts | Installation - Copper gutters | DEFAULT_GUTTERS_SERVICE_5 |  | $400.00 |  |  |  |  |  | Expert gutter intallation service |
| Gutters > Installation > Gutters and downspouts | Installation - Guards | DEFAULT_GUTTERS_SERVICE_6 |  | $400.00 |  |  |  |  |  | Expert gutter intallation service |
| Gutters > Installation > Gutters and downspouts | Installation - Half round gutter | DEFAULT_GUTTERS_SERVICE_7 |  | $400.00 |  |  |  |  |  | Expert gutter intallation service |
| Gutters > Installation > Gutters and downspouts | Installation - K Gutter | DEFAULT_GUTTERS_SERVICE_8 |  | $400.00 |  |  |  |  |  | Expert gutter intallation service |
| Gutters > Installation > Drainage | Installation - French drains | DEFAULT_GUTTERS_SERVICE_9 |  | $400.00 |  |  |  |  |  | Expert french drain intallation service |
| Gutters > Installation > Other | Installation - Something else / I don't know | DEFAULT_GUTTERS_SERVICE_10 |  | $400.00 |  |  |  |  |  | Expert gutter intallation service |
| Gutters > Maintenance > Gutters and downspouts | Maintenance - Regular gutters | DEFAULT_GUTTERS_SERVICE_11 |  | $300.00 |  |  |  |  |  | Expert gutter maintenance service |
| Gutters > Maintenance > Gutters and downspouts | Maintenance - Seamless gutters | DEFAULT_GUTTERS_SERVICE_12 |  | $300.00 |  |  |  |  |  | Expert gutter maintenance service |
| Gutters > Maintenance > Gutters and downspouts | Maintenance - Downspouts | DEFAULT_GUTTERS_SERVICE_13 |  | $300.00 |  |  |  |  |  | Expert gutter maintenance service |
| Gutters > Maintenance > Gutters and downspouts | Maintenance - Box Gutter | DEFAULT_GUTTERS_SERVICE_14 |  | $300.00 |  |  |  |  |  | Expert gutter maintenance service |
| Gutters > Maintenance > Gutters and downspouts | Maintenance - Copper Gutters | DEFAULT_GUTTERS_SERVICE_15 |  | $300.00 |  |  |  |  |  | Expert gutter maintenance service |
| Gutters > Maintenance > Gutters and downspouts | Maintenance - Guards | DEFAULT_GUTTERS_SERVICE_16 |  | $300.00 |  |  |  |  |  | Expert gutter maintenance service |
| Gutters > Maintenance > Gutters and downspouts | Maintenance - Half round gutter | DEFAULT_GUTTERS_SERVICE_17 |  | $300.00 |  |  |  |  |  | Expert gutter maintenance service |
| Gutters > Maintenance > Gutters and downspouts | Maintenance - K gutter | DEFAULT_GUTTERS_SERVICE_18 |  | $300.00 |  |  |  |  |  | Expert gutter maintenance service |
| Gutters > Maintenance > Gutters and downspouts | Maintenance - Painting | DEFAULT_GUTTERS_SERVICE_19 |  | $300.00 |  |  |  |  |  | Expert gutter painting service |
| Gutters > Maintenance > Gutters and downspouts | Maintenance - Cleaning | DEFAULT_GUTTERS_SERVICE_20 |  | $300.00 |  |  |  |  |  | Expert gutter cleaning service |
| Gutters > Maintenance > Other | Maintenance - Something else / I don't know | DEFAULT_GUTTERS_SERVICE_21 |  | $300.00 |  |  |  |  |  | Expert gutter maintenance service |
| Gutters > Repair > Gutters and downspouts | Repair - Regular gutters | DEFAULT_GUTTERS_SERVICE_22 |  | $400.00 |  |  |  |  |  | Expert gutter repair service |
| Gutters > Repair > Gutters and downspouts | Repair - Seamless gutters | DEFAULT_GUTTERS_SERVICE_23 |  | $400.00 |  |  |  |  |  | Expert gutter repair service |
| Gutters > Repair > Gutters and downspouts | Repair - Downspouts | DEFAULT_GUTTERS_SERVICE_24 |  | $400.00 |  |  |  |  |  | Expert gutter repair service |
| Gutters > Repair > Gutters and downspouts | Repair - Box Gutter | DEFAULT_GUTTERS_SERVICE_25 |  | $400.00 |  |  |  |  |  | Expert gutter repair service |
| Gutters > Repair > Gutters and downspouts | Repair - Copper Gutters | DEFAULT_GUTTERS_SERVICE_26 |  | $400.00 |  |  |  |  |  | Expert gutter repair service |
| Gutters > Repair > Gutters and downspouts | Repair - Guards | DEFAULT_GUTTERS_SERVICE_27 |  | $400.00 |  |  |  |  |  | Expert gutter repair service |
| Gutters > Repair > Gutters and downspouts | Repair - Half round gutter | DEFAULT_GUTTERS_SERVICE_28 |  | $400.00 |  |  |  |  |  | Expert gutter repair service |
| Gutters > Repair > Gutters and downspouts | Repair - K gutter | DEFAULT_GUTTERS_SERVICE_29 |  | $400.00 |  |  |  |  |  | Expert gutter repair service |
| Gutters > Repair > Gutters and downspouts | Repair - Painting | DEFAULT_GUTTERS_SERVICE_30 |  | $400.00 |  |  |  |  |  | Expert gutter painting service |
| Gutters > Repair > Gutters and downspouts | Repair - Cleaning | DEFAULT_GUTTERS_SERVICE_31 |  | $400.00 |  |  |  |  |  | Expert gutter cleaning service |
| Gutters > Repair > Drainage | Repair - French drains | DEFAULT_GUTTERS_SERVICE_32 |  | $400.00 |  |  |  |  |  | Expert french drain repair service |
| Gutters > Repair > Other | Repair - Something else / I don't know | DEFAULT_GUTTERS_SERVICE_33 |  | $400.00 |  |  |  |  |  | Expert gutter repair service |

## Health & Beauty

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Health & beauty > Health & beauty > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Health & beauty > Health & beauty > General request | Health & beauty - Book an appointment | DEFAULT_BEAUTY_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Home Inspection

- Services: **16** (16 with a task code, 0 without) in **2** categories (` > ` = nested subcategory): Home Inspection > Inspection > Home, Home Inspection > Inspection > Other
- Pricing insight available for 0 of 16 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Home Inspection > Inspection > Home | Inspection - Standard single family | DEFAULT_INSPECTION_SERVICE_1 |  | $500.00 |  |  |  |  |  | Expert home inspection service |
| Home Inspection > Inspection > Home | Inspection - Standard multifamily | DEFAULT_INSPECTION_SERVICE_2 |  | $500.00 |  |  |  |  |  | Expert home inspection service |
| Home Inspection > Inspection > Home | Inspection - 4 point | DEFAULT_INSPECTION_SERVICE_3 |  | $500.00 |  |  |  |  |  | Expert home inspection service |
| Home Inspection > Inspection > Home | Inspection - Pre-drywall (new construction) | DEFAULT_INSPECTION_SERVICE_4 |  | $500.00 |  |  |  |  |  | Expert home inspection service |
| Home Inspection > Inspection > Home | Inspection - Pre-closing (older home) | DEFAULT_INSPECTION_SERVICE_5 |  | $500.00 |  |  |  |  |  | Expert home inspection service |
| Home Inspection > Inspection > Home | Inspection - Post-closing (older home) | DEFAULT_INSPECTION_SERVICE_6 |  | $500.00 |  |  |  |  |  | Expert home inspection service |
| Home Inspection > Inspection > Home | Inspection - Pre-closing (new construction) | DEFAULT_INSPECTION_SERVICE_7 |  | $500.00 |  |  |  |  |  | Expert home inspection service |
| Home Inspection > Inspection > Home | Inspection - Post-closing (new construction) | DEFAULT_INSPECTION_SERVICE_8 |  | $500.00 |  |  |  |  |  | Expert home inspection service |
| Home Inspection > Inspection > Home | Inspection - After closing 11 month (new construction) | DEFAULT_INSPECTION_SERVICE_9 |  | $500.00 |  |  |  |  |  | Expert home inspection service |
| Home Inspection > Inspection > Other | Inspection - WDO (wood destroying organisms) | DEFAULT_INSPECTION_SERVICE_10 |  | $500.00 |  |  |  |  |  | Expert WDO inspection service |
| Home Inspection > Inspection > Other | Inspection - Foundation | DEFAULT_INSPECTION_SERVICE_11 |  | $500.00 |  |  |  |  |  | Expert foundation inspection service |
| Home Inspection > Inspection > Other | Inspection - Asbestos testing | DEFAULT_INSPECTION_SERVICE_12 |  | $500.00 |  |  |  |  |  | Expert asbestos testing service |
| Home Inspection > Inspection > Other | Inspection - Mold testing | DEFAULT_INSPECTION_SERVICE_13 |  | $500.00 |  |  |  |  |  | Expert mold testing service |
| Home Inspection > Inspection > Other | Inspection - Lead-based paint testing | DEFAULT_INSPECTION_SERVICE_14 |  | $500.00 |  |  |  |  |  | Expert lead-based paint testing service |
| Home Inspection > Inspection > Other | Inspection - Radon testing | DEFAULT_INSPECTION_SERVICE_15 |  | $500.00 |  |  |  |  |  | Expert radon testing service |
| Home Inspection > Inspection > Other | Inspection - Something else / I don't know | DEFAULT_INSPECTION_SERVICE_16 |  | $500.00 |  |  |  |  |  | Expert home inspection service |

## Install & Assemble

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Install & assemble > Install & assemble > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Install & assemble > Install & assemble > General request | Install & assemble - Book an appointment | DEFAULT_INSTALL_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Insurance

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Insurance > Insurance > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Insurance > Insurance > General request | Insurance - Book an appointment | DEFAULT_INSURANCE_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Interior & Surface Cleaning

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Interior & surface cleaning > Interior & surface cleaning > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Interior & surface cleaning > Interior & surface cleaning > General request | Interior & surface cleaning - Book an appointment | DEFAULT_INTERIOR_CLEANING_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Janitorial

- Services: **24** (24 with a task code, 0 without) in **6** categories (` > ` = nested subcategory): Janitorial > Recurring > Office / buildings, Janitorial > Recurring > Flooring, Janitorial > Recurring > Other, Janitorial > One time > Office / buildings, Janitorial > One time > Flooring, Janitorial > One time > Other
- Pricing insight available for 15 of 24 services; median of medians **$140**

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Janitorial > Recurring > Office / buildings | Recurring - Office / commercial cleaning | DEFAULT_JANITORIAL_SERVICE_1 |  | $200.00 | $135 | $165 | $210 |  |  | Expert office cleaning service |
| Janitorial > Recurring > Office / buildings | Recurring - Reception area / lobby cleaning | DEFAULT_JANITORIAL_SERVICE_2 |  | $200.00 | $140 | $175 | $280 |  |  | Expert lobby cleaning service |
| Janitorial > Recurring > Office / buildings | Recurring - Kitchen / restroom cleaning | DEFAULT_JANITORIAL_SERVICE_3 |  | $200.00 | $20 | $40 | $100 |  |  | Expert kitchen / restroom cleaning service |
| Janitorial > Recurring > Office / buildings | Recurring - Daytime cleaning | DEFAULT_JANITORIAL_SERVICE_4 |  | $200.00 | $55 | $70 | $90 |  |  | Expert office daytime cleaning service |
| Janitorial > Recurring > Office / buildings | Recurring - Dusting | DEFAULT_JANITORIAL_SERVICE_5 |  | $200.00 |  |  |  |  |  | Expert dusting service |
| Janitorial > Recurring > Office / buildings | Recurring - Window washing | DEFAULT_JANITORIAL_SERVICE_6 |  | $200.00 | $10 | $10 | $217 |  |  | Expert window washing service |
| Janitorial > Recurring > Flooring | Recurring - Carpet cleaning | DEFAULT_JANITORIAL_SERVICE_7 |  | $200.00 | $105 | $120 | $155 |  |  | Expert carpet cleaning service |
| Janitorial > Recurring > Flooring | Recurring - Hard-surface floor cleaning | DEFAULT_JANITORIAL_SERVICE_8 |  | $200.00 | $100 | $140 | $184 |  |  | Expert hard floor cleaning service |
| Janitorial > Recurring > Other | Recurring - Restocking | DEFAULT_JANITORIAL_SERVICE_9 |  | $200.00 |  |  |  |  |  | Expert office restocking service |
| Janitorial > Recurring > Other | Recurring - Waste removal | DEFAULT_JANITORIAL_SERVICE_10 |  | $200.00 | $50 | $200 | $225 |  |  | Expert waste removal service |
| Janitorial > Recurring > Other | Recurring - Sanitation | DEFAULT_JANITORIAL_SERVICE_11 |  | $200.00 |  |  |  |  |  | Expert sanitation service |
| Janitorial > Recurring > Other | Recurring - Something else / I don't know | DEFAULT_JANITORIAL_SERVICE_12 |  | $200.00 |  |  |  |  |  | Expert office cleaning service |
| Janitorial > One time > Office / buildings | One time - Office / commercial cleaning | DEFAULT_JANITORIAL_SERVICE_13 |  | $200.00 | $80 | $140 | $200 |  |  | Expert office cleaning service |
| Janitorial > One time > Office / buildings | One time - Reception area / lobby cleaning | DEFAULT_JANITORIAL_SERVICE_14 |  | $200.00 |  |  |  |  |  | Expert lobby cleaning service |
| Janitorial > One time > Office / buildings | One time - Kitchen / restroom cleaning | DEFAULT_JANITORIAL_SERVICE_15 |  | $200.00 | $150 | $225 | $225 |  |  | Expert kitchen / restroom cleaning service |
| Janitorial > One time > Office / buildings | One time - Daytime cleaning | DEFAULT_JANITORIAL_SERVICE_16 |  | $200.00 | $110 | $220 | $330 |  |  | Expert office daytime cleaning service |
| Janitorial > One time > Office / buildings | One time - Dusting | DEFAULT_JANITORIAL_SERVICE_17 |  | $200.00 |  |  |  |  |  | Expert dusting service |
| Janitorial > One time > Office / buildings | One time - Window washing | DEFAULT_JANITORIAL_SERVICE_18 |  | $200.00 | $25 | $55 | $221 |  |  | Expert window washing service |
| Janitorial > One time > Flooring | One time - Carpet cleaning | DEFAULT_JANITORIAL_SERVICE_19 |  | $200.00 | $104 | $200 | $271 |  |  | Expert carpet cleaning service |
| Janitorial > One time > Flooring | One time - Hard-surface floor cleaning | DEFAULT_JANITORIAL_SERVICE_20 |  | $200.00 | $90 | $95 | $200 |  |  | Expert hard floor cleaning service |
| Janitorial > One time > Other | One time - Restocking | DEFAULT_JANITORIAL_SERVICE_21 |  | $200.00 |  |  |  |  |  | Expert office restocking service |
| Janitorial > One time > Other | One time - Waste removal | DEFAULT_JANITORIAL_SERVICE_22 |  | $200.00 | $50 | $50 | $50 |  |  | Expert waste removal service |
| Janitorial > One time > Other | One time - Sanitation | DEFAULT_JANITORIAL_SERVICE_23 |  | $200.00 |  |  |  |  |  | Expert sanitation service |
| Janitorial > One time > Other | One time - Something else / I don't know | DEFAULT_JANITORIAL_SERVICE_24 |  | $200.00 |  |  |  |  |  | Expert office cleaning service |

## Junk Removal

- Services: **18** (18 with a task code, 0 without) in **8** categories (` > ` = nested subcategory): Junk Removal > Removal > Furniture & Appliances, Junk Removal > Removal > Electronics, Junk Removal > Removal > Outdoors, Junk Removal > Removal > Construction waste & debris, Junk Removal > Removal > Rental , Junk Removal > Removal > Disposal, Junk Removal > Removal > Other, Junk Removal > Other > Clean-out
- Pricing insight available for 5 of 18 services; median of medians **$230**

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Junk Removal > Removal > Furniture & Appliances | Removal - Appliance | DEFAULT_JUNK_SERVICE_1 |  | $200.00 | $100 | $150 | $200 |  |  | Expert appliance removal services |
| Junk Removal > Removal > Furniture & Appliances | Removal - Furniture | DEFAULT_JUNK_SERVICE_2 |  | $200.00 | $149 | $200 | $300 |  |  | Expert furniture removal services |
| Junk Removal > Removal > Electronics | Removal - TV | DEFAULT_JUNK_SERVICE_3 |  | $200.00 |  |  |  |  |  | Expert TV removal services |
| Junk Removal > Removal > Electronics | Removal - Other electronics | DEFAULT_JUNK_SERVICE_4 |  | $200.00 |  |  |  |  |  | Expert electronics removal services |
| Junk Removal > Removal > Outdoors | Removal - Shed | DEFAULT_JUNK_SERVICE_5 |  | $200.00 | $429 | $850 | $1,600 |  |  | Expert shed removal services |
| Junk Removal > Removal > Outdoors | Removal - Spa/hot tub | DEFAULT_JUNK_SERVICE_6 |  | $200.00 |  |  |  |  |  | Expert spa/hot tub removal services |
| Junk Removal > Removal > Outdoors | Removal - Yard waste | DEFAULT_JUNK_SERVICE_7 |  | $200.00 |  |  |  |  |  | Expert yard waste removal services |
| Junk Removal > Removal > Construction waste & debris | Removal - Construction waste | DEFAULT_JUNK_SERVICE_8 |  | $200.00 |  |  |  |  |  | Expert construction waste removal services |
| Junk Removal > Removal > Construction waste & debris | Removal - Debris | DEFAULT_JUNK_SERVICE_9 |  | $200.00 |  |  |  |  |  | Expert debris removal services |
| Junk Removal > Removal > Construction waste & debris | Removal - Dirt/concrete | DEFAULT_JUNK_SERVICE_10 |  | $200.00 |  |  |  |  |  | Expert dirt/concrete removal services |
| Junk Removal > Removal > Construction waste & debris | Removal - Hazardous waste/paint disposal | DEFAULT_JUNK_SERVICE_11 |  | $200.00 |  |  |  |  |  | Expert hazardous waste/paint disposal services |
| Junk Removal > Removal > Construction waste & debris | Removal - Hazardous waste/paint | DEFAULT_JUNK_SERVICE_12 |  | $200.00 |  |  |  |  |  | Expert hazardous waste/paint removal services |
| Junk Removal > Removal > Rental  | Removal - Dumpster rental | DEFAULT_JUNK_SERVICE_13 |  | $200.00 | $150 | $350 | $550 |  |  | Expert dumpster rental services |
| Junk Removal > Removal > Disposal | Removal - Something else / I don't know | DEFAULT_JUNK_SERVICE_14 |  | $200.00 |  |  |  |  |  | Expert disposal services |
| Junk Removal > Removal > Other | Removal - General junk | DEFAULT_JUNK_SERVICE_15 |  | $200.00 | $150 | $230 | $425 |  |  | Expert junk removal services |
| Junk Removal > Other > Clean-out | Other - Whole building | DEFAULT_JUNK_SERVICE_16 |  | $250.00 |  |  |  |  |  | Expert clean-out services |
| Junk Removal > Other > Clean-out | Other - Foreclosed home | DEFAULT_JUNK_SERVICE_17 |  | $250.00 |  |  |  |  |  | Expert clean-out services |
| Junk Removal > Other > Clean-out | Other - Move-out cleanup | DEFAULT_JUNK_SERVICE_18 |  | $250.00 |  |  |  |  |  | Expert clean-out services |

## Laundry

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Laundry > Laundry > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Laundry > Laundry > General request | Laundry - Book an appointment | DEFAULT_LAUNDRY_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Lawyer

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Lawyer > Lawyer > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Lawyer > Lawyer > General request | Lawyer - Book an appointment | DEFAULT_LAWYER_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Lender

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Lender > Lender > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Lender > Lender > General request | Lender - Book an appointment | DEFAULT_LENDER_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Lighting

- Services: **36** (36 with a task code, 0 without) in **8** categories (` > ` = nested subcategory): Lighting > Installation > Lighting & fixtures, Lighting > Installation > Electrical, Lighting > Installation > Smart home & security, Lighting > Installation > Other, Lighting > Repair > Lighting & fixtures, Lighting > Repair > Electrical, Lighting > Repair > Smart home & security, Lighting > Repair > Other
- Pricing insight available for 11 of 36 services; median of medians **$193**

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Lighting > Installation > Lighting & fixtures | Installation - Interior lighting | DEFAULT_LIGHTING_SERVICE_1 |  | $200.00 | $150 | $189 | $426 |  |  | Expert interior lighting  installation service |
| Lighting > Installation > Lighting & fixtures | Installation - Ceiling fan | DEFAULT_LIGHTING_SERVICE_2 |  | $200.00 | $150 | $200 | $306 |  |  | Expert ceiling fan installation service |
| Lighting > Installation > Lighting & fixtures | Installation - LED lighting | DEFAULT_LIGHTING_SERVICE_3 |  | $200.00 |  |  |  |  |  | Expert led lighting installation service |
| Lighting > Installation > Lighting & fixtures | Installation - Exterior/outdoor lighting | DEFAULT_LIGHTING_SERVICE_4 |  | $200.00 |  |  |  |  |  | Expert exterior/outdoor lighting installation service |
| Lighting > Installation > Lighting & fixtures | Installation - Landscape lighting | DEFAULT_LIGHTING_SERVICE_5 |  | $200.00 |  |  |  |  |  | Expert landscape lighting installation service |
| Lighting > Installation > Lighting & fixtures | Installation - Medicine cabinet lighting | DEFAULT_LIGHTING_SERVICE_6 |  | $200.00 |  |  |  |  |  | Expert medicine cabinet lighting installation service |
| Lighting > Installation > Lighting & fixtures | Installation - Lighted bathroom mirror | DEFAULT_LIGHTING_SERVICE_7 |  | $200.00 |  |  |  |  |  | Expert lighted bathroom mirror installation service |
| Lighting > Installation > Lighting & fixtures | Installation - Light switch | DEFAULT_LIGHTING_SERVICE_8 |  | $200.00 | $149 | $256 | $280 |  |  | Expert light switch installation service |
| Lighting > Installation > Electrical | Installation - Circuit breaker | DEFAULT_LIGHTING_SERVICE_9 |  | $200.00 |  |  |  |  |  | Expert circuit breaker installation service |
| Lighting > Installation > Electrical | Installation - Electrical panel | DEFAULT_LIGHTING_SERVICE_10 |  | $200.00 |  |  |  |  |  | Expert electrical panel installation service |
| Lighting > Installation > Electrical | Installation - Electrical subpanel | DEFAULT_LIGHTING_SERVICE_11 |  | $200.00 |  |  |  |  |  | Expert electrical subpanel installation service |
| Lighting > Installation > Electrical | Installation - Electrical wiring | DEFAULT_LIGHTING_SERVICE_12 |  | $200.00 | $363 | $708 | $750 |  |  | Expert electrical wiring service |
| Lighting > Installation > Electrical | Installation - 240V outlet | DEFAULT_LIGHTING_SERVICE_13 |  | $200.00 |  |  |  |  |  | Expert 240v outlet installation service |
| Lighting > Installation > Electrical | Installation - GFCI outlet | DEFAULT_LIGHTING_SERVICE_14 |  | $200.00 | $95 | $204 | $278 |  |  | Expert gfci outlet installation service |
| Lighting > Installation > Electrical | Installation - Standard outlet | DEFAULT_LIGHTING_SERVICE_15 |  | $200.00 | $75 | $75 | $151 |  |  | Expert standard outlet installation service |
| Lighting > Installation > Smart home & security | Installation - Security / smart camera | DEFAULT_LIGHTING_SERVICE_16 |  | $200.00 |  |  |  |  |  | Expert security / smart camera installation service |
| Lighting > Installation > Smart home & security | Installation - Security / smart lighting | DEFAULT_LIGHTING_SERVICE_17 |  | $200.00 |  |  |  |  |  | Expert security / smart lighting installation service |
| Lighting > Installation > Other | Installation - Something else / I don't know | DEFAULT_LIGHTING_SERVICE_18 |  | $200.00 |  |  |  |  |  | Expert lighting installation service |
| Lighting > Repair > Lighting & fixtures | Repair - Interior lighting | DEFAULT_LIGHTING_SERVICE_19 |  | $200.00 |  |  |  |  |  | Expert interior lighting  repair service |
| Lighting > Repair > Lighting & fixtures | Repair - Ceiling fan | DEFAULT_LIGHTING_SERVICE_20 |  | $200.00 | $120 | $155 | $250 |  |  | Expert ceiling fan repair service |
| Lighting > Repair > Lighting & fixtures | Repair - LED lighting | DEFAULT_LIGHTING_SERVICE_21 |  | $200.00 |  |  |  |  |  | Expert led lighting repair service |
| Lighting > Repair > Lighting & fixtures | Repair - Exterior/outdoor lighting | DEFAULT_LIGHTING_SERVICE_22 |  | $200.00 | $144 | $282 | $440 |  |  | Expert exterior/outdoor lighting repair service |
| Lighting > Repair > Lighting & fixtures | Repair - Landscape lighting | DEFAULT_LIGHTING_SERVICE_23 |  | $200.00 |  |  |  |  |  | Expert landscape lighting repair service |
| Lighting > Repair > Lighting & fixtures | Repair - Medicine cabinet lighting | DEFAULT_LIGHTING_SERVICE_24 |  | $200.00 |  |  |  |  |  | Expert medicine cabinet lighting repair service |
| Lighting > Repair > Lighting & fixtures | Repair - Lighted bathroom mirror | DEFAULT_LIGHTING_SERVICE_25 |  | $200.00 |  |  |  |  |  | Expert lighted bathroom mirror repair service |
| Lighting > Repair > Lighting & fixtures | Repair - Light switch | DEFAULT_LIGHTING_SERVICE_26 |  | $200.00 | $25 | $106 | $225 |  |  | Expert light switch repair service |
| Lighting > Repair > Electrical | Repair - Circuit breaker | DEFAULT_LIGHTING_SERVICE_27 |  | $200.00 |  |  |  |  |  | Expert circuit breaker repair service |
| Lighting > Repair > Electrical | Repair - Electrical panel | DEFAULT_LIGHTING_SERVICE_28 |  | $200.00 |  |  |  |  |  | Expert electrical panel repair service |
| Lighting > Repair > Electrical | Repair - Electrical subpanel | DEFAULT_LIGHTING_SERVICE_29 |  | $200.00 |  |  |  |  |  | Expert electrical subpanel repair service |
| Lighting > Repair > Electrical | Repair - Electrical rewiring | DEFAULT_LIGHTING_SERVICE_30 |  | $200.00 |  |  |  |  |  | Expert electrical rewiring service |
| Lighting > Repair > Electrical | Repair - 240V outlet | DEFAULT_LIGHTING_SERVICE_31 |  | $200.00 |  |  |  |  |  | Expert 240v outlet repair service |
| Lighting > Repair > Electrical | Repair - GFCI outlet | DEFAULT_LIGHTING_SERVICE_32 |  | $200.00 | $125 | $193 | $340 |  |  | Expert gfci outlet repair service |
| Lighting > Repair > Electrical | Repair - Standard outlet | DEFAULT_LIGHTING_SERVICE_33 |  | $200.00 | $10 | $16 | $20 |  |  | Expert standard outlet repair service |
| Lighting > Repair > Smart home & security | Repair - Security / smart camera | DEFAULT_LIGHTING_SERVICE_34 |  | $200.00 |  |  |  |  |  | Expert security / smart camera repair service |
| Lighting > Repair > Smart home & security | Repair - Security / smart lighting | DEFAULT_LIGHTING_SERVICE_35 |  | $200.00 |  |  |  |  |  | Expert security / smart lighting repair service |
| Lighting > Repair > Other | Repair - Something else / I don't know | DEFAULT_LIGHTING_SERVICE_36 |  | $200.00 |  |  |  |  |  | Expert something else / i don't know repair service |

## Locksmith

- Services: **20** (20 with a task code, 0 without) in **8** categories (` > ` = nested subcategory): Locksmith > Repair > Lockout, Locksmith > Installation > Lockbox, Locksmith > Replace > Re-key, Locksmith > Replace > Keys and locks, Locksmith > Replace > Fob, Locksmith > Removal > Lockbox, Locksmith > Purchase > Keys and locks, Locksmith > Purchase > Fob
- Pricing insight available for 0 of 20 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Locksmith > Repair > Lockout | Repair - Building lockout | DEFAULT_LOCKSMITH_SERVICE_1 |  | $150.00 |  |  |  |  |  | Expert lockout service |
| Locksmith > Repair > Lockout | Repair - Bike lock / padlock | DEFAULT_LOCKSMITH_SERVICE_2 |  | $150.00 |  |  |  |  |  | Expert lockout service |
| Locksmith > Repair > Lockout | Repair - Vehicle lockout | DEFAULT_LOCKSMITH_SERVICE_3 |  | $150.00 |  |  |  |  |  | Expert lockout service |
| Locksmith > Repair > Lockout | Repair - Unlock club / steerling wheel | DEFAULT_LOCKSMITH_SERVICE_4 |  | $150.00 |  |  |  |  |  | Expert lockout service |
| Locksmith > Repair > Lockout | Repair - Home lockout | DEFAULT_LOCKSMITH_SERVICE_5 |  | $150.00 |  |  |  |  |  | Expert lockout service |
| Locksmith > Repair > Lockout | Repair - Safe combination | DEFAULT_LOCKSMITH_SERVICE_6 |  | $150.00 |  |  |  |  |  | Expert lockout service |
| Locksmith > Installation > Lockbox | Installation - Lockbox | DEFAULT_LOCKSMITH_SERVICE_7 |  | $100.00 |  |  |  |  |  | Expert lockbox installation service |
| Locksmith > Replace > Re-key | Replace - Mailbox | DEFAULT_LOCKSMITH_SERVICE_8 |  | $100.00 |  |  |  |  |  | Expert mailbox re-key service |
| Locksmith > Replace > Re-key | Replace - Door locks | DEFAULT_LOCKSMITH_SERVICE_9 |  | $100.00 |  |  |  |  |  | Expert door locks re-key service |
| Locksmith > Replace > Keys and locks | Replace - Automotive keys | DEFAULT_LOCKSMITH_SERVICE_10 |  | $100.00 |  |  |  |  |  | Expert automotive key replacement service |
| Locksmith > Replace > Keys and locks | Replace - Building keys | DEFAULT_LOCKSMITH_SERVICE_11 |  | $100.00 |  |  |  |  |  | Expert building key replacement service |
| Locksmith > Replace > Keys and locks | Replace - Other keys | DEFAULT_LOCKSMITH_SERVICE_12 |  | $100.00 |  |  |  |  |  | Expert key replacement service |
| Locksmith > Replace > Keys and locks | Replace - Door locks | DEFAULT_LOCKSMITH_SERVICE_13 |  | $100.00 |  |  |  |  |  | Expert door lock replacement service |
| Locksmith > Replace > Fob | Replace - Key fob | DEFAULT_LOCKSMITH_SERVICE_14 |  | $100.00 |  |  |  |  |  | Expert key fob replacement service |
| Locksmith > Removal > Lockbox | Removal - Lockbox | DEFAULT_LOCKSMITH_SERVICE_15 |  | $100.00 |  |  |  |  |  | Expert lockbox removal service |
| Locksmith > Purchase > Keys and locks | Purchase - Automotive keys | DEFAULT_LOCKSMITH_SERVICE_16 |  | $100.00 |  |  |  |  |  | Expert automotive key purchase service |
| Locksmith > Purchase > Keys and locks | Purchase - Building keys | DEFAULT_LOCKSMITH_SERVICE_17 |  | $100.00 |  |  |  |  |  | Expert building key purchase service |
| Locksmith > Purchase > Keys and locks | Purchase - Other keys | DEFAULT_LOCKSMITH_SERVICE_18 |  | $100.00 |  |  |  |  |  | Expert key purchase service |
| Locksmith > Purchase > Keys and locks | Purchase - Door locks | DEFAULT_LOCKSMITH_SERVICE_19 |  | $100.00 |  |  |  |  |  | Expert door lock purchase service |
| Locksmith > Purchase > Fob | Purchase - Key fob | DEFAULT_LOCKSMITH_SERVICE_20 |  | $100.00 |  |  |  |  |  | Expert key fob purchase service |

## Marine Services

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Marine services > Marine services > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Marine services > Marine services > General request | Marine services - Book an appointment | DEFAULT_MARINE_SERVICES_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Massage

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Massage > Massage > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Massage > Massage > General request | Massage - Book an appointment | DEFAULT_MASSAGE_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Medical

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Medical > Medical > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Medical > Medical > General request | Medical - Book an appointment | DEFAULT_MEDICAL_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Mortgage Broker

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Mortgage broker > Mortgage broker > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Mortgage broker > Mortgage broker > General request | Mortgage broker - Book an appointment | DEFAULT_MORTGAGE_BROKER_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Moving

- Services: **22** (22 with a task code, 0 without) in **4** categories (` > ` = nested subcategory): Moving > Estimate > Email estimate, Moving > Estimate > In home, Moving > Estimate > Hourly rate, Moving > Estimate > Other
- Pricing insight available for 0 of 22 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Moving > Estimate > Email estimate | Estimate - Apartment - 1 bedroom | DEFAULT_MOVING_SERVICE_1 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Apartment - 2 bedrooms | DEFAULT_MOVING_SERVICE_2 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Apartment - 3+ bedrooms | DEFAULT_MOVING_SERVICE_3 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Condo - 1 bedroom | DEFAULT_MOVING_SERVICE_4 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Condo - 2 bedrooms | DEFAULT_MOVING_SERVICE_5 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Condo - 3+ bedrooms | DEFAULT_MOVING_SERVICE_6 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Duplex - 1 bedroom | DEFAULT_MOVING_SERVICE_7 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Duplex - 2 bedrooms | DEFAULT_MOVING_SERVICE_8 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Duplex - 3 bedrooms | DEFAULT_MOVING_SERVICE_9 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Duplex - 4+ bedrooms | DEFAULT_MOVING_SERVICE_10 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Office/commercial building | DEFAULT_MOVING_SERVICE_11 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Single family - 2 bedroom | DEFAULT_MOVING_SERVICE_12 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Single family - 3 bedrooms | DEFAULT_MOVING_SERVICE_13 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Single family - 4 bedrooms | DEFAULT_MOVING_SERVICE_14 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Single family - 5+ bedroom | DEFAULT_MOVING_SERVICE_15 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Townhouse - 1 story | DEFAULT_MOVING_SERVICE_16 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Townhouse - 2 story | DEFAULT_MOVING_SERVICE_17 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Email estimate | Estimate - Townhouse - 3 story | DEFAULT_MOVING_SERVICE_18 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > In home | Estimate - In home estimate | DEFAULT_MOVING_SERVICE_19 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Hourly rate | Estimate - 2 Men | DEFAULT_MOVING_SERVICE_20 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Hourly rate | Estimate - 3 Men | DEFAULT_MOVING_SERVICE_21 |  | $400.00 |  |  |  |  |  | Expert moving service |
| Moving > Estimate > Other | Estimate - Something else / I don't know | DEFAULT_MOVING_SERVICE_22 |  | $400.00 |  |  |  |  |  | Expert moving service |

## Music & Singing

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Music & singing > Music & singing > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Music & singing > Music & singing > General request | Music & singing - Book an appointment | DEFAULT_MUSIC_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Natural Stone

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Natural stone > Natural stone > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Natural stone > Natural stone > General request | Natural stone - Book an appointment | DEFAULT_NATURAL_STONE_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Neighborhood Chores

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Neighborhood chores > Neighborhood chores > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Neighborhood chores > Neighborhood chores > General request | Neighborhood chores - Book an appointment | DEFAULT_IN_MY_NEIGHBORHOOD_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Notary

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Notary > Notary > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Notary > Notary > General request | Notary - Book an appointment | DEFAULT_NOTARY_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Organization & Interior Design

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Organization & interior design > Organization & interior design > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Organization & interior design > Organization & interior design > General request | Organization & interior design - Book an appointment | DEFAULT_ORGANIZE_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Parties

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Parties > Parties > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Parties > Parties > General request | Parties - Book an appointment | DEFAULT_PARTY_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Pets

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Pets > Pets > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Pets > Pets > General request | Pets - Book an appointment | DEFAULT_PETS_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Photography

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Photography > Photography > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Photography > Photography > General request | Photography - Book an appointment | DEFAULT_PHOTOGRAPHY_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Pool & Spa

- Services: **35** (35 with a task code, 0 without) in **10** categories (` > ` = nested subcategory): Pool & Spa > Diagnostic > Backflow testing, Pool & Spa > Diagnostic > Camera inspection, Pool & Spa > Diagnostic > Leak detection, Pool & Spa > Installation > Equipment and accessories, Pool & Spa > Installation > Other, Pool & Spa > Maintenance > Cleaning, Pool & Spa > Maintenance > Other, Pool & Spa > One time > Pool openings/closings, Pool & Spa > Repair > Equipment and accessories, Pool & Spa > Repair > Other
- Pricing insight available for 0 of 35 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Pool & Spa > Diagnostic > Backflow testing | Diagnostic - Backflow testing / back flow valve | DEFAULT_POOL_SERVICE_1 |  | $200.00 |  |  |  |  |  | Expert pool diagnostic service |
| Pool & Spa > Diagnostic > Camera inspection | Diagnostic - Camera the lines/drains | DEFAULT_POOL_SERVICE_2 |  | $200.00 |  |  |  |  |  | Expert pool diagnostic service |
| Pool & Spa > Diagnostic > Leak detection | Diagnostic - Full leak detection | DEFAULT_POOL_SERVICE_3 |  | $200.00 |  |  |  |  |  | Expert pool diagnostic service |
| Pool & Spa > Installation > Equipment and accessories | Installation - Chlorinators | DEFAULT_POOL_SERVICE_4 |  | $200.00 |  |  |  |  |  | Expert pool equipment installation service |
| Pool & Spa > Installation > Equipment and accessories | Installation - Covers | DEFAULT_POOL_SERVICE_5 |  | $200.00 |  |  |  |  |  | Expert pool equipment installation service |
| Pool & Spa > Installation > Equipment and accessories | Installation - Filters | DEFAULT_POOL_SERVICE_6 |  | $200.00 |  |  |  |  |  | Expert pool equipment installation service |
| Pool & Spa > Installation > Equipment and accessories | Installation - Lights | DEFAULT_POOL_SERVICE_7 |  | $200.00 |  |  |  |  |  | Expert pool equipment installation service |
| Pool & Spa > Installation > Equipment and accessories | Installation - Liners | DEFAULT_POOL_SERVICE_8 |  | $200.00 |  |  |  |  |  | Expert pool equipment installation service |
| Pool & Spa > Installation > Equipment and accessories | Installation - Pool drains | DEFAULT_POOL_SERVICE_9 |  | $200.00 |  |  |  |  |  | Expert pool equipment installation service |
| Pool & Spa > Installation > Equipment and accessories | Installation - Pool heaters | DEFAULT_POOL_SERVICE_10 |  | $200.00 |  |  |  |  |  | Expert pool equipment installation service |
| Pool & Spa > Installation > Equipment and accessories | Installation - Pool steps | DEFAULT_POOL_SERVICE_11 |  | $200.00 |  |  |  |  |  | Expert pool equipment installation service |
| Pool & Spa > Installation > Equipment and accessories | Installation - Pumps (speed pump) | DEFAULT_POOL_SERVICE_12 |  | $200.00 |  |  |  |  |  | Expert pool equipment installation service |
| Pool & Spa > Installation > Equipment and accessories | Installation - Skimmers | DEFAULT_POOL_SERVICE_13 |  | $200.00 |  |  |  |  |  | Expert pool equipment installation service |
| Pool & Spa > Installation > Other | Installation - Something else / I don't know | DEFAULT_POOL_SERVICE_14 |  | $200.00 |  |  |  |  |  | Expert pool equipment installation service |
| Pool & Spa > Maintenance > Cleaning | Maintenance - Clean intake line (hot tub) | DEFAULT_POOL_SERVICE_15 |  | $120.00 |  |  |  |  |  | Expert pool cleaning service |
| Pool & Spa > Maintenance > Cleaning | Maintenance - Clean skimmer (hot tub) | DEFAULT_POOL_SERVICE_16 |  | $120.00 |  |  |  |  |  | Expert pool cleaning service |
| Pool & Spa > Maintenance > Cleaning | Maintenance - Jetting drain clean out | DEFAULT_POOL_SERVICE_17 |  | $120.00 |  |  |  |  |  | Expert pool cleaning service |
| Pool & Spa > Maintenance > Cleaning | Maintenance - Clean intake line | DEFAULT_POOL_SERVICE_18 |  | $120.00 |  |  |  |  |  | Expert pool cleaning service |
| Pool & Spa > Maintenance > Cleaning | Maintenance - Clean skimmer | DEFAULT_POOL_SERVICE_19 |  | $120.00 |  |  |  |  |  | Expert pool cleaning service |
| Pool & Spa > Maintenance > Cleaning | Maintenance - Recurring cleaning | DEFAULT_POOL_SERVICE_20 |  | $120.00 |  |  |  |  |  | Expert pool cleaning service |
| Pool & Spa > Maintenance > Other | Maintenance - Pool painting | DEFAULT_POOL_SERVICE_21 |  | $120.00 |  |  |  |  |  | Expert pool painting service |
| Pool & Spa > Maintenance > Other | Maintenance - Something else / I don't know | DEFAULT_POOL_SERVICE_22 |  | $120.00 |  |  |  |  |  | Expert pool maintenance service |
| Pool & Spa > One time > Pool openings/closings | One time - Pool closing | DEFAULT_POOL_SERVICE_23 |  | $250.00 |  |  |  |  |  | Expert pool closing service |
| Pool & Spa > One time > Pool openings/closings | One time - Pool opening | DEFAULT_POOL_SERVICE_24 |  | $250.00 |  |  |  |  |  | Expert pool opening service |
| Pool & Spa > Repair > Equipment and accessories | Repair - Chlorinator | DEFAULT_POOL_SERVICE_25 |  | $200.00 |  |  |  |  |  | Expert pool repair service |
| Pool & Spa > Repair > Equipment and accessories | Repair - Cover | DEFAULT_POOL_SERVICE_26 |  | $200.00 |  |  |  |  |  | Expert pool repair service |
| Pool & Spa > Repair > Equipment and accessories | Repair - Filter | DEFAULT_POOL_SERVICE_27 |  | $200.00 |  |  |  |  |  | Expert pool repair service |
| Pool & Spa > Repair > Equipment and accessories | Repair - Lights | DEFAULT_POOL_SERVICE_28 |  | $200.00 |  |  |  |  |  | Expert pool repair service |
| Pool & Spa > Repair > Equipment and accessories | Repair - Liners | DEFAULT_POOL_SERVICE_29 |  | $200.00 |  |  |  |  |  | Expert pool repair service |
| Pool & Spa > Repair > Equipment and accessories | Repair - Pool drains | DEFAULT_POOL_SERVICE_30 |  | $200.00 |  |  |  |  |  | Expert pool repair service |
| Pool & Spa > Repair > Equipment and accessories | Repair - Pool heaters | DEFAULT_POOL_SERVICE_31 |  | $200.00 |  |  |  |  |  | Expert pool repair service |
| Pool & Spa > Repair > Equipment and accessories | Repair - Pool steps | DEFAULT_POOL_SERVICE_32 |  | $200.00 |  |  |  |  |  | Expert pool repair service |
| Pool & Spa > Repair > Equipment and accessories | Repair - Pumps (speed pump) | DEFAULT_POOL_SERVICE_33 |  | $200.00 |  |  |  |  |  | Expert pool repair service |
| Pool & Spa > Repair > Equipment and accessories | Repair - Skimmers | DEFAULT_POOL_SERVICE_34 |  | $200.00 |  |  |  |  |  | Expert pool repair service |
| Pool & Spa > Repair > Other | Repair - Something else / I don't know | DEFAULT_POOL_SERVICE_35 |  | $200.00 |  |  |  |  |  | Expert pool repair service |

## Property Manager

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Property manager > Property manager > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Property manager > Property manager > General request | Property manager - Book an appointment | DEFAULT_PROPERTY_MANAGER_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Real Estate

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Real estate > Real estate > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Real estate > Real estate > General request | Real estate - Book an appointment | DEFAULT_REALESTATE_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Restoration

- Services: **52** (52 with a task code, 0 without) in **12** categories (` > ` = nested subcategory): Restoration > Repair > Fire Damage, Restoration > Repair > Storm Damage, Restoration > Repair > Water Damage, Restoration > Repair > Drainage system, Restoration > Repair > Cleanup, Restoration > Repair > Resurfacing / refinish, Restoration > Repair > Other, Restoration > Treatment > Testing, Restoration > Installation > Temporary, Restoration > Installation > Drainage system, Restoration > Installation > Other, Restoration > Removal > Demo / removal
- Pricing insight available for 0 of 52 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Restoration > Repair > Fire Damage | Repair - Structural shoring & bracing | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_1 |  | $400.00 |  |  |  |  |  | Expert fire damage repair service |
| Restoration > Repair > Fire Damage | Repair - Fast track demolition & cleanup | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_2 |  | $400.00 |  |  |  |  |  | Expert fire damage repair service |
| Restoration > Repair > Fire Damage | Repair - Smoke & soot removal | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_3 |  | $400.00 |  |  |  |  |  | Expert fire damage repair service |
| Restoration > Repair > Fire Damage | Repair - Deodorization | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_4 |  | $400.00 |  |  |  |  |  | Expert fire damage repair service |
| Restoration > Repair > Fire Damage | Repair - Complete fire damage repair | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_5 |  | $400.00 |  |  |  |  |  | Expert fire damage repair service |
| Restoration > Repair > Storm Damage | Repair - Water extraction and mitigation | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_6 |  | $400.00 |  |  |  |  |  | Expert storm damage repair service |
| Restoration > Repair > Storm Damage | Repair - Tarp services | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_7 |  | $400.00 |  |  |  |  |  | Expert storm damage repair service |
| Restoration > Repair > Storm Damage | Repair - Complete storm damage repair | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_8 |  | $400.00 |  |  |  |  |  | Expert storm damage repair service |
| Restoration > Repair > Water Damage | Repair - Moisture detection | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_9 |  | $400.00 |  |  |  |  |  | Expert water damage repair service |
| Restoration > Repair > Water Damage | Repair - Water extraction and mitigation | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_10 |  | $400.00 |  |  |  |  |  | Expert water damage repair service |
| Restoration > Repair > Water Damage | Repair - Monitored structural drying | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_11 |  | $400.00 |  |  |  |  |  | Expert water damage repair service |
| Restoration > Repair > Water Damage | Repair - Sewage clean-up, sanitation and disposal | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_12 |  | $400.00 |  |  |  |  |  | Expert water damage repair service |
| Restoration > Repair > Water Damage | Repair - Disinfection and odor neutralization | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_13 |  | $400.00 |  |  |  |  |  | Expert water damage repair service |
| Restoration > Repair > Water Damage | Repair - Complete water damage repair | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_14 |  | $400.00 |  |  |  |  |  | Expert water damage repair service |
| Restoration > Repair > Drainage system | Repair - Sewage backups | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_15 |  | $400.00 |  |  |  |  |  | Expert drainage system repair service |
| Restoration > Repair > Drainage system | Repair - Sump pump | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_16 |  | $400.00 |  |  |  |  |  | Expert drainage system repair service |
| Restoration > Repair > Cleanup | Repair - Biohazard/crime scene | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_17 |  | $400.00 |  |  |  |  |  | Expert biohazard/crime scene cleanup service |
| Restoration > Repair > Cleanup | Repair - Emergency vehicle | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_18 |  | $400.00 |  |  |  |  |  | Expert emergency vehicle cleanup service |
| Restoration > Repair > Cleanup | Repair - Hoarder | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_19 |  | $400.00 |  |  |  |  |  | Expert hoarder cleanup service |
| Restoration > Repair > Cleanup | Repair - Homeless encampment | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_20 |  | $400.00 |  |  |  |  |  | Expert homeless encampment cleanup service |
| Restoration > Repair > Cleanup | Repair - Medical waste | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_21 |  | $400.00 |  |  |  |  |  | Expert medical waste cleanup service |
| Restoration > Repair > Cleanup | Repair - Odor removal | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_22 |  | $400.00 |  |  |  |  |  | Expert odor removal service |
| Restoration > Repair > Cleanup | Repair - Rodent droppings | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_23 |  | $400.00 |  |  |  |  |  | Expert rodent droppings cleanup service |
| Restoration > Repair > Cleanup | Repair - Tear gas | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_24 |  | $400.00 |  |  |  |  |  | Expert tear gas cleanup service |
| Restoration > Repair > Cleanup | Repair - Vandalism/graffiti | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_25 |  | $400.00 |  |  |  |  |  | Expert vandalism cleanup service |
| Restoration > Repair > Cleanup | Repair - Virus disinfection/COVID | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_26 |  | $400.00 |  |  |  |  |  | Expert virus disinfection service |
| Restoration > Repair > Resurfacing / refinish | Repair - Countertops | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_27 |  | $400.00 |  |  |  |  |  | Expert refinishing service |
| Restoration > Repair > Resurfacing / refinish | Repair - Bathtubs | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_28 |  | $400.00 |  |  |  |  |  | Expert refinishing service |
| Restoration > Repair > Resurfacing / refinish | Repair - Shower / shower pan | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_29 |  | $400.00 |  |  |  |  |  | Expert refinishing service |
| Restoration > Repair > Resurfacing / refinish | Repair - Sinks | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_30 |  | $400.00 |  |  |  |  |  | Expert refinishing service |
| Restoration > Repair > Resurfacing / refinish | Repair - Ceramic tile | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_31 |  | $400.00 |  |  |  |  |  | Expert refinishing service |
| Restoration > Repair > Other | Repair - Vapor Barriers | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_32 |  | $400.00 |  |  |  |  |  | Expert vapor barrier repair service |
| Restoration > Treatment > Testing | Treatment - Asbestos testing | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_33 |  | $250.00 |  |  |  |  |  | Expert asbestos testing service |
| Restoration > Treatment > Testing | Treatment - Mold testing | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_34 |  | $250.00 |  |  |  |  |  | Expert mold testing service |
| Restoration > Treatment > Testing | Treatment - Lead-based paint testing | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_35 |  | $250.00 |  |  |  |  |  | Expert lead-based paint testing service |
| Restoration > Treatment > Testing | Treatment - Radon testing | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_36 |  | $250.00 |  |  |  |  |  | Expert radon testing service |
| Restoration > Installation > Temporary | Installation - Temporary power generation | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_37 |  | $500.00 |  |  |  |  |  | Expert temporary power generation service |
| Restoration > Installation > Temporary | Installation - Temporary roofing system | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_38 |  | $500.00 |  |  |  |  |  | Expert temporary roofing system service |
| Restoration > Installation > Temporary | Installation - Roof tarp/board-up | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_39 |  | $500.00 |  |  |  |  |  | Expert temporary roof tarp/board-up service |
| Restoration > Installation > Drainage system | Installation - Sump pump | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_40 |  | $500.00 |  |  |  |  |  | Expert sump pump installation service |
| Restoration > Installation > Drainage system | Installation - Install | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_41 |  | $500.00 |  |  |  |  |  | Expert installation service for drainage system |
| Restoration > Installation > Other | Installation - Vapor Barriers | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_42 |  | $500.00 |  |  |  |  |  | Expert vapor barrier install service |
| Restoration > Removal > Demo / removal | Removal - Carpet | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_43 |  | $500.00 |  |  |  |  |  | Expert carpet removal service |
| Restoration > Removal > Demo / removal | Removal - Drywall | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_44 |  | $500.00 |  |  |  |  |  | Expert drywall removal service |
| Restoration > Removal > Demo / removal | Removal - Flooring | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_45 |  | $500.00 |  |  |  |  |  | Expert flooring removal service |
| Restoration > Removal > Demo / removal | Removal - Paneling | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_46 |  | $500.00 |  |  |  |  |  | Expert paneling removal service |
| Restoration > Removal > Demo / removal | Removal - Tiling | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_47 |  | $500.00 |  |  |  |  |  | Expert tiling removal service |
| Restoration > Removal > Demo / removal | Removal - Asbestos | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_48 |  | $500.00 |  |  |  |  |  | Expert asbestos removal service |
| Restoration > Removal > Demo / removal | Removal - Lead-based paint | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_49 |  | $500.00 |  |  |  |  |  | Expert lead-based paint removal service |
| Restoration > Removal > Demo / removal | Removal - Mold | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_50 |  | $500.00 |  |  |  |  |  | Expert mold removal service |
| Restoration > Removal > Demo / removal | Removal - Radon mitigation | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_51 |  | $500.00 |  |  |  |  |  | Expert radon removal service |
| Restoration > Removal > Demo / removal | Removal - Tree removal | DEFAULT_FIRE_FLOOD_MOLD_SERVICE_52 |  | $500.00 |  |  |  |  |  | Expert tree removal service |

## Regulatory & Environmental

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Regulatory & environmental > Regulatory & environmental > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Regulatory & environmental > Regulatory & environmental > General request | Regulatory & environmental - Book an appointment | DEFAULT_REGULATORY_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Roof & Attic

- Services: **59** (59 with a task code, 0 without) in **10** categories (` > ` = nested subcategory): Roof & Attic > Cleaning > Roof, Roof & Attic > Cleaning > Gutters, Roof & Attic > Cleaning > Other, Roof & Attic > Inspection > Roof Inspection, Roof & Attic > Installation > Roof Treatment, Roof & Attic > Installation > Roof Replacement, Roof & Attic > Installation > Roof & Shingles, Roof & Attic > Installation > Other, Roof & Attic > Repair > Roof & Shingles, Roof & Attic > Repair > Other
- Pricing insight available for 0 of 59 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Roof & Attic > Cleaning > Roof | Cleaning - Roof Cleaning | DEFAULT_ROOFING_SERVICE_1 |  | $450.00 |  |  |  |  |  | Expert roof cleaning service |
| Roof & Attic > Cleaning > Gutters | Cleaning - Gutters Clean Out | DEFAULT_ROOFING_SERVICE_2 |  | $450.00 |  |  |  |  |  | Expert gutters clean out service |
| Roof & Attic > Cleaning > Other | Cleaning - Something Else / I Don'T Know | DEFAULT_ROOFING_SERVICE_3 |  | $450.00 |  |  |  |  |  | Expert roof cleaning service |
| Roof & Attic > Inspection > Roof Inspection | Inspection - Expert Roof Inspection | DEFAULT_ROOFING_SERVICE_4 |  | $350.00 |  |  |  |  |  | Expert roof inspection service |
| Roof & Attic > Installation > Roof Treatment | Installation - Asphalt Shingle | DEFAULT_ROOFING_SERVICE_5 |  | $800.00 |  |  |  |  |  | Expert asphalt shingle roof treatment service |
| Roof & Attic > Installation > Roof Treatment | Installation - Clay Tile | DEFAULT_ROOFING_SERVICE_6 |  | $800.00 |  |  |  |  |  | Expert clay tile roof treatment service |
| Roof & Attic > Installation > Roof Treatment | Installation - Concrete Tile | DEFAULT_ROOFING_SERVICE_7 |  | $800.00 |  |  |  |  |  | Expert concrete tile roof treatment service |
| Roof & Attic > Installation > Roof Treatment | Installation - Metal | DEFAULT_ROOFING_SERVICE_8 |  | $800.00 |  |  |  |  |  | Expert metal roof treatment service |
| Roof & Attic > Installation > Roof Treatment | Installation - Other Materials | DEFAULT_ROOFING_SERVICE_9 |  | $800.00 |  |  |  |  |  | Expert other materials roof treatment service |
| Roof & Attic > Installation > Roof Treatment | Installation - Rolled/Flat Roof | DEFAULT_ROOFING_SERVICE_10 |  | $800.00 |  |  |  |  |  | Expert rolled/flat roof roof treatment service |
| Roof & Attic > Installation > Roof Treatment | Installation - Slate | DEFAULT_ROOFING_SERVICE_11 |  | $800.00 |  |  |  |  |  | Expert slate roof treatment service |
| Roof & Attic > Installation > Roof Treatment | Installation - Solar Shingle | DEFAULT_ROOFING_SERVICE_12 |  | $800.00 |  |  |  |  |  | Expert solar shingle roof treatment service |
| Roof & Attic > Installation > Roof Treatment | Installation - Vinyl | DEFAULT_ROOFING_SERVICE_13 |  | $800.00 |  |  |  |  |  | Expert vinyl roof treatment service |
| Roof & Attic > Installation > Roof Treatment | Installation - Wood Shake | DEFAULT_ROOFING_SERVICE_14 |  | $800.00 |  |  |  |  |  | Expert wood shake roof treatment service |
| Roof & Attic > Installation > Roof Replacement | Installation - Asphalt Shingle | DEFAULT_ROOFING_SERVICE_15 |  | $800.00 |  |  |  |  |  | Expert asphalt shingle roof replacement service |
| Roof & Attic > Installation > Roof Replacement | Installation - Clay Tile | DEFAULT_ROOFING_SERVICE_16 |  | $800.00 |  |  |  |  |  | Expert clay tile roof replacement service |
| Roof & Attic > Installation > Roof Replacement | Installation - Concrete Tile | DEFAULT_ROOFING_SERVICE_17 |  | $800.00 |  |  |  |  |  | Expert concrete tile roof replacement service |
| Roof & Attic > Installation > Roof Replacement | Installation - Metal | DEFAULT_ROOFING_SERVICE_18 |  | $800.00 |  |  |  |  |  | Expert metal roof replacement service |
| Roof & Attic > Installation > Roof Replacement | Installation - Other Materials | DEFAULT_ROOFING_SERVICE_19 |  | $800.00 |  |  |  |  |  | Expert other materials roof replacement service |
| Roof & Attic > Installation > Roof Replacement | Installation - Rolled/Flat Roof | DEFAULT_ROOFING_SERVICE_20 |  | $800.00 |  |  |  |  |  | Expert rolled/flat roof roof replacement service |
| Roof & Attic > Installation > Roof Replacement | Installation - Slate | DEFAULT_ROOFING_SERVICE_21 |  | $800.00 |  |  |  |  |  | Expert slate roof replacement service |
| Roof & Attic > Installation > Roof Replacement | Installation - Solar Shingles | DEFAULT_ROOFING_SERVICE_22 |  | $800.00 |  |  |  |  |  | Expert solar shingles roof replacement service |
| Roof & Attic > Installation > Roof Replacement | Installation - Vinyl | DEFAULT_ROOFING_SERVICE_23 |  | $800.00 |  |  |  |  |  | Expert vinyl roof replacement service |
| Roof & Attic > Installation > Roof Replacement | Installation - Wood Shake | DEFAULT_ROOFING_SERVICE_24 |  | $800.00 |  |  |  |  |  | Expert wood shake roof replacement service |
| Roof & Attic > Installation > Roof & Shingles | Installation - Melt System | DEFAULT_ROOFING_SERVICE_25 |  | $800.00 |  |  |  |  |  | Expert melt system installation service |
| Roof & Attic > Installation > Roof & Shingles | Installation - Roof Flashing | DEFAULT_ROOFING_SERVICE_26 |  | $800.00 |  |  |  |  |  | Expert roof flashing installation service |
| Roof & Attic > Installation > Roof & Shingles | Installation - Roof Treatment | DEFAULT_ROOFING_SERVICE_27 |  | $800.00 |  |  |  |  |  | Expert roof treatment service |
| Roof & Attic > Installation > Roof & Shingles | Installation - Roof Vents | DEFAULT_ROOFING_SERVICE_28 |  | $800.00 |  |  |  |  |  | Expert roof vents installation service |
| Roof & Attic > Installation > Roof & Shingles | Installation - Soffit/Fascia | DEFAULT_ROOFING_SERVICE_29 |  | $800.00 |  |  |  |  |  | Expert soffit/fascia installation service |
| Roof & Attic > Installation > Roof & Shingles | Installation - Shingles | DEFAULT_ROOFING_SERVICE_30 |  | $800.00 |  |  |  |  |  | Expert shingles installation service |
| Roof & Attic > Installation > Other | Installation - Chimney Cricket/Saddle | DEFAULT_ROOFING_SERVICE_31 |  | $800.00 |  |  |  |  |  | Expert chimney cricket/saddle installation service |
| Roof & Attic > Installation > Other | Installation - Gutters | DEFAULT_ROOFING_SERVICE_32 |  | $800.00 |  |  |  |  |  | Expert gutters installation service |
| Roof & Attic > Installation > Other | Installation - Insulation | DEFAULT_ROOFING_SERVICE_33 |  | $800.00 |  |  |  |  |  | Expert insulation installation service |
| Roof & Attic > Installation > Other | Installation - Siding | DEFAULT_ROOFING_SERVICE_34 |  | $800.00 |  |  |  |  |  | Expert siding installation service |
| Roof & Attic > Installation > Other | Installation - Something Else / I Don'T Know | DEFAULT_ROOFING_SERVICE_35 |  | $800.00 |  |  |  |  |  | Expert roof installation service |
| Roof & Attic > Installation > Other | Installation - Windows | DEFAULT_ROOFING_SERVICE_36 |  | $800.00 |  |  |  |  |  | Expert windows installation service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Asphalt Shingle | DEFAULT_ROOFING_SERVICE_37 |  | $1,000.00 |  |  |  |  |  | Expert asphalt shingle repair service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Clay Tile | DEFAULT_ROOFING_SERVICE_38 |  | $1,000.00 |  |  |  |  |  | Expert clay tile repair service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Concrete Tile | DEFAULT_ROOFING_SERVICE_39 |  | $1,000.00 |  |  |  |  |  | Expert concrete tile repair service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Cracked/Broken Shingles | DEFAULT_ROOFING_SERVICE_40 |  | $1,000.00 |  |  |  |  |  | Expert cracked/broken shingles service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Melt System | DEFAULT_ROOFING_SERVICE_41 |  | $1,000.00 |  |  |  |  |  | Expert melt system repair service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Metal | DEFAULT_ROOFING_SERVICE_42 |  | $1,000.00 |  |  |  |  |  | Expert metal repair service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Other Materials | DEFAULT_ROOFING_SERVICE_43 |  | $1,000.00 |  |  |  |  |  | Expert other materials repair service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Replace Missing Shingles | DEFAULT_ROOFING_SERVICE_44 |  | $1,000.00 |  |  |  |  |  | Expert replace missing shingles service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Rolled/Flat Roof | DEFAULT_ROOFING_SERVICE_45 |  | $1,000.00 |  |  |  |  |  | Expert rolled/flat roof repair service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Roof Flashing | DEFAULT_ROOFING_SERVICE_46 |  | $1,000.00 |  |  |  |  |  | Expert roof flashing repair service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Roof Vents | DEFAULT_ROOFING_SERVICE_47 |  | $1,000.00 |  |  |  |  |  | Expert roof vents repair service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Slate | DEFAULT_ROOFING_SERVICE_48 |  | $1,000.00 |  |  |  |  |  | Expert slate repair service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Soffit/Fascia | DEFAULT_ROOFING_SERVICE_49 |  | $1,000.00 |  |  |  |  |  | Expert soffit/fascia repair service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Solar Shingle | DEFAULT_ROOFING_SERVICE_50 |  | $1,000.00 |  |  |  |  |  | Expert solar shingle repair service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Something Else / I Don'T Know | DEFAULT_ROOFING_SERVICE_51 |  | $1,000.00 |  |  |  |  |  | Expert roof & shingles repair service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Vinyl | DEFAULT_ROOFING_SERVICE_52 |  | $1,000.00 |  |  |  |  |  | Expert vinyl repair service |
| Roof & Attic > Repair > Roof & Shingles | Repair - Wood Shake | DEFAULT_ROOFING_SERVICE_53 |  | $1,000.00 |  |  |  |  |  | Expert wood shake repair service |
| Roof & Attic > Repair > Other | Repair - Chimney Cricket/Saddle | DEFAULT_ROOFING_SERVICE_54 |  | $1,000.00 |  |  |  |  |  | Expert chimney cricket/saddle repair service |
| Roof & Attic > Repair > Other | Repair - Gutters | DEFAULT_ROOFING_SERVICE_55 |  | $1,000.00 |  |  |  |  |  | Expert gutters repair service |
| Roof & Attic > Repair > Other | Repair - Insulation | DEFAULT_ROOFING_SERVICE_56 |  | $1,000.00 |  |  |  |  |  | Expert insulation repair service |
| Roof & Attic > Repair > Other | Repair - Siding | DEFAULT_ROOFING_SERVICE_57 |  | $1,000.00 |  |  |  |  |  | Expert siding repair service |
| Roof & Attic > Repair > Other | Repair - Something Else / I Don'T Know | DEFAULT_ROOFING_SERVICE_58 |  | $1,000.00 |  |  |  |  |  | Expert repair service |
| Roof & Attic > Repair > Other | Repair - Windows | DEFAULT_ROOFING_SERVICE_59 |  | $1,000.00 |  |  |  |  |  | Expert windows repair service |

## Rug Cleaning

- Services: **1** (0 with a task code, 1 without) in **1** category (` > ` = nested subcategory): Custom Services
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Custom Services | Custom job |  |  | $0.00 |  |  |  |  | yes | Pro will provide you a quote if the work you need does not fit into one of our standard categories. / Please provide as much detail as possible, including pictures. |

## Security

- Services: **58** (58 with a task code, 0 without) in **10** categories (` > ` = nested subcategory): Security > Installation > Cameras and security, Security > Installation > Electrical and lighting, Security > Installation > Fire control, Security > Installation > Other, Security > Repair > Cameras and security, Security > Repair > Electrical and lighting, Security > Repair > Fire control, Security > Repair > Other, Security > Emergency > Alarm, Security > Maintenance > Cameras and security
- Pricing insight available for 7 of 58 services; median of medians **$157**

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Security > Installation > Cameras and security | Installation - Audio camera | DEFAULT_SECURITY_SERVICE_1 |  | $350.00 |  |  |  |  |  | Expert cameras and security system installation service |
| Security > Installation > Cameras and security | Installation - Door lock | DEFAULT_SECURITY_SERVICE_2 |  | $350.00 |  |  |  |  |  | Expert cameras and security system installation service |
| Security > Installation > Cameras and security | Installation - Floodlight camera | DEFAULT_SECURITY_SERVICE_3 |  | $350.00 |  |  |  |  |  | Expert cameras and security system installation service |
| Security > Installation > Cameras and security | Installation - Hard wired camera | DEFAULT_SECURITY_SERVICE_4 |  | $350.00 |  |  |  |  |  | Expert cameras and security system installation service |
| Security > Installation > Cameras and security | Installation - Mailbox camera | DEFAULT_SECURITY_SERVICE_5 |  | $350.00 |  |  |  |  |  | Expert cameras and security system installation service |
| Security > Installation > Cameras and security | Installation - Motion sensor | DEFAULT_SECURITY_SERVICE_6 |  | $350.00 |  |  |  |  |  | Expert cameras and security system installation service |
| Security > Installation > Cameras and security | Installation - Security system package | DEFAULT_SECURITY_SERVICE_7 |  | $350.00 |  |  |  |  |  | Expert cameras and security system installation service |
| Security > Installation > Cameras and security | Installation - Security touch panel | DEFAULT_SECURITY_SERVICE_8 |  | $350.00 |  |  |  |  |  | Expert cameras and security system installation service |
| Security > Installation > Cameras and security | Installation - Security TV screen | DEFAULT_SECURITY_SERVICE_9 |  | $350.00 |  |  |  |  |  | Expert cameras and security system installation service |
| Security > Installation > Cameras and security | Installation - Video doorbell | DEFAULT_SECURITY_SERVICE_10 |  | $350.00 |  |  |  |  |  | Expert cameras and security system installation service |
| Security > Installation > Cameras and security | Installation - Wifi network extendor | DEFAULT_SECURITY_SERVICE_11 |  | $350.00 |  |  |  |  |  | Expert cameras and security system installation service |
| Security > Installation > Cameras and security | Installation - Window / door sensor | DEFAULT_SECURITY_SERVICE_12 |  | $350.00 |  |  |  |  |  | Expert cameras and security system installation service |
| Security > Installation > Cameras and security | Installation - Wireless camera | DEFAULT_SECURITY_SERVICE_13 |  | $350.00 |  |  |  |  |  | Expert cameras and security system installation service |
| Security > Installation > Cameras and security | Installation - Wireless camera | DEFAULT_SECURITY_SERVICE_14 |  | $350.00 |  |  |  |  |  | Expert cameras and security system installation service |
| Security > Installation > Electrical and lighting | Installation - 240V outlet | DEFAULT_SECURITY_SERVICE_15 |  | $350.00 |  |  |  |  |  | Expert 240v outlet installation service |
| Security > Installation > Electrical and lighting | Installation - Exterior lighting | DEFAULT_SECURITY_SERVICE_16 |  | $350.00 |  |  |  |  |  | Expert exterior lighting installation service |
| Security > Installation > Electrical and lighting | Installation - GFCI outlet | DEFAULT_SECURITY_SERVICE_17 |  | $350.00 | $95 | $204 | $278 |  |  | Expert gfci outlet installation service |
| Security > Installation > Electrical and lighting | Installation - Landscape lighting | DEFAULT_SECURITY_SERVICE_18 |  | $350.00 |  |  |  |  |  | Expert landscape lighting installation service |
| Security > Installation > Electrical and lighting | Installation - Light switch | DEFAULT_SECURITY_SERVICE_19 |  | $350.00 | $149 | $256 | $280 |  |  | Expert light switch installation service |
| Security > Installation > Electrical and lighting | Installation - Standard outlet | DEFAULT_SECURITY_SERVICE_20 |  | $350.00 | $75 | $75 | $151 |  |  | Expert standard outlet installation service |
| Security > Installation > Electrical and lighting | Installation - Thermostat | DEFAULT_SECURITY_SERVICE_21 |  | $350.00 | $112 | $157 | $191 |  |  | Expert thermostat installation service |
| Security > Installation > Electrical and lighting | Installation - Wiring | DEFAULT_SECURITY_SERVICE_22 |  | $350.00 |  |  |  |  |  | Expert wiring service |
| Security > Installation > Fire control | Installation - Fire alarm | DEFAULT_SECURITY_SERVICE_23 |  | $350.00 |  |  |  |  |  | Expert fire alarm installation service |
| Security > Installation > Fire control | Installation - Range Exhaust | DEFAULT_SECURITY_SERVICE_24 |  | $350.00 |  |  |  |  |  | Expert range exhaust installation service |
| Security > Installation > Other | Installation - Solar inverter | DEFAULT_SECURITY_SERVICE_25 |  | $350.00 |  |  |  |  |  | Expert solar inverter installation service |
| Security > Installation > Other | Installation - Solar Panel | DEFAULT_SECURITY_SERVICE_26 |  | $350.00 |  |  |  |  |  | Expert solar panel installation service |
| Security > Installation > Other | Installation - Something else / I don't know | DEFAULT_SECURITY_SERVICE_27 |  | $350.00 |  |  |  |  |  | Expert installation service |
| Security > Installation > Other | Installation - Wiring for electrical pool | DEFAULT_SECURITY_SERVICE_28 |  | $350.00 |  |  |  |  |  | Expert wiring for electrical pool service |
| Security > Repair > Cameras and security | Repair - Audio camera | DEFAULT_SECURITY_SERVICE_29 |  | $250.00 |  |  |  |  |  | Expert audio camera repair service |
| Security > Repair > Cameras and security | Repair - Data / cloud storage | DEFAULT_SECURITY_SERVICE_30 |  | $250.00 |  |  |  |  |  | Expert data / cloud storage repair service |
| Security > Repair > Cameras and security | Repair - Door lock | DEFAULT_SECURITY_SERVICE_31 |  | $250.00 |  |  |  |  |  | Expert door lock repair service |
| Security > Repair > Cameras and security | Repair - Floodlight camera | DEFAULT_SECURITY_SERVICE_32 |  | $250.00 |  |  |  |  |  | Expert floodlight camera repair service |
| Security > Repair > Cameras and security | Repair - Hard wired camera | DEFAULT_SECURITY_SERVICE_33 |  | $250.00 |  |  |  |  |  | Expert hard wired camera repair service |
| Security > Repair > Cameras and security | Repair - Mailbox camera | DEFAULT_SECURITY_SERVICE_34 |  | $250.00 |  |  |  |  |  | Expert mailbox camera repair service |
| Security > Repair > Cameras and security | Repair - Motion sensor | DEFAULT_SECURITY_SERVICE_35 |  | $250.00 |  |  |  |  |  | Expert motion sensor repair service |
| Security > Repair > Cameras and security | Repair - Security system | DEFAULT_SECURITY_SERVICE_36 |  | $250.00 |  |  |  |  |  | Expert security system repair service |
| Security > Repair > Cameras and security | Repair - Security touch panel | DEFAULT_SECURITY_SERVICE_37 |  | $250.00 |  |  |  |  |  | Expert security touch panel repair service |
| Security > Repair > Cameras and security | Repair - Security TV screen | DEFAULT_SECURITY_SERVICE_38 |  | $250.00 |  |  |  |  |  | Expert security tv screen  repair service |
| Security > Repair > Cameras and security | Repair - Video doorbell | DEFAULT_SECURITY_SERVICE_39 |  | $250.00 |  |  |  |  |  | Expert video doorbell repair service |
| Security > Repair > Cameras and security | Repair - Wifi network extendor | DEFAULT_SECURITY_SERVICE_40 |  | $250.00 |  |  |  |  |  | Expert wifi network extendor repair service |
| Security > Repair > Cameras and security | Repair - Window / door sensor | DEFAULT_SECURITY_SERVICE_41 |  | $250.00 |  |  |  |  |  | Expert window / door sensor  repair service |
| Security > Repair > Cameras and security | Repair - Wireless camera | DEFAULT_SECURITY_SERVICE_42 |  | $250.00 |  |  |  |  |  | Expert wireless camera repair service |
| Security > Repair > Cameras and security | Repair - Wireless camera | DEFAULT_SECURITY_SERVICE_43 |  | $250.00 |  |  |  |  |  | Expert wireless camera repair service |
| Security > Repair > Electrical and lighting | Repair - 240V outlet | DEFAULT_SECURITY_SERVICE_44 |  | $250.00 |  |  |  |  |  | Expert 240v outlet repair service |
| Security > Repair > Electrical and lighting | Repair - Exterior lighting | DEFAULT_SECURITY_SERVICE_45 |  | $250.00 |  |  |  |  |  | Expert exterior lighting repair service |
| Security > Repair > Electrical and lighting | Repair - GFCI outlet | DEFAULT_SECURITY_SERVICE_46 |  | $250.00 | $125 | $193 | $340 |  |  | Expert gfci outlet repair service |
| Security > Repair > Electrical and lighting | Repair - Landscape Lighting | DEFAULT_SECURITY_SERVICE_47 |  | $250.00 |  |  |  |  |  | Expert landscape lighting repair service |
| Security > Repair > Electrical and lighting | Repair - Light switch | DEFAULT_SECURITY_SERVICE_48 |  | $250.00 | $25 | $106 | $225 |  |  | Expert light switch repair service |
| Security > Repair > Electrical and lighting | Repair - Standard outlet | DEFAULT_SECURITY_SERVICE_49 |  | $250.00 | $10 | $16 | $20 |  |  | Expert standard outlet repair service |
| Security > Repair > Electrical and lighting | Repair - Thermostat | DEFAULT_SECURITY_SERVICE_50 |  | $250.00 |  |  |  |  |  | Expert thermostat  repair service |
| Security > Repair > Fire control | Repair - Fire Alarm | DEFAULT_SECURITY_SERVICE_51 |  | $250.00 |  |  |  |  |  | Expert fire alarm repair service |
| Security > Repair > Fire control | Repair - Range Exhaust | DEFAULT_SECURITY_SERVICE_52 |  | $250.00 |  |  |  |  |  | Expert range exhaust repair service |
| Security > Repair > Other | Repair - Solar inverter | DEFAULT_SECURITY_SERVICE_53 |  | $250.00 |  |  |  |  |  | Expert solar inverter repair service |
| Security > Repair > Other | Repair - Solar Panel | DEFAULT_SECURITY_SERVICE_54 |  | $250.00 |  |  |  |  |  | Expert solar panel repair service |
| Security > Repair > Other | Repair - Rewiring for electrical pool | DEFAULT_SECURITY_SERVICE_55 |  | $250.00 |  |  |  |  |  | Expert rewiring for electrical pool repair service |
| Security > Repair > Other | Repair - Something else / I don't know | DEFAULT_SECURITY_SERVICE_56 |  | $250.00 |  |  |  |  |  | Expert repair service |
| Security > Emergency > Alarm | Emergency - 911/Alarm going off | DEFAULT_SECURITY_SERVICE_57 |  | $200.00 |  |  |  |  |  | Emergency service for alarm going off |
| Security > Maintenance > Cameras and security | Maintenance - Alarm Monitoring | DEFAULT_SECURITY_SERVICE_58 |  | $100.00 |  |  |  |  |  | Expert maintenance service for alarm monitoring |

## Sewer & Septic

- Services: **24** (24 with a task code, 0 without) in **10** categories (` > ` = nested subcategory): Sewer and Septic > Inspection > Certified inspection, Sewer and Septic > Inspection > Other, Sewer and Septic > Installation > Septic system, Sewer and Septic > Installation > Sewer, Sewer and Septic > Installation > Other, Sewer and Septic > Maintenance > Cleaning, Sewer and Septic > Maintenance > Pumping, Sewer and Septic > Maintenance > Other, Sewer and Septic > Repair > Septic system, Sewer and Septic > Repair > Sewer
- Pricing insight available for 0 of 24 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Sewer and Septic > Inspection > Certified inspection | Inspection - Sewer scope | DEFAULT_SEWER_SERVICE_1 |  | $150.00 |  |  |  |  |  | Expert sewer scope inspection service |
| Sewer and Septic > Inspection > Certified inspection | Inspection - Septic system | DEFAULT_SEWER_SERVICE_2 |  | $150.00 |  |  |  |  |  | Expert septic system inspection service |
| Sewer and Septic > Inspection > Other | Inspection - Perc test | DEFAULT_SEWER_SERVICE_3 |  | $150.00 |  |  |  |  |  | Expert perc test service |
| Sewer and Septic > Installation > Septic system | Installation - Septic tank | DEFAULT_SEWER_SERVICE_4 |  | $7,000.00 |  |  |  |  |  | Expert septic tank installation service |
| Sewer and Septic > Installation > Septic system | Installation - Aerobic septic system | DEFAULT_SEWER_SERVICE_5 |  | $7,000.00 |  |  |  |  |  | Expert septic system installation service |
| Sewer and Septic > Installation > Septic system | Installation - Conventional septic | DEFAULT_SEWER_SERVICE_6 |  | $7,000.00 |  |  |  |  |  | Expert septic system installation service |
| Sewer and Septic > Installation > Septic system | Installation - Other septic system | DEFAULT_SEWER_SERVICE_7 |  | $7,000.00 |  |  |  |  |  | Expert septic system installation service |
| Sewer and Septic > Installation > Sewer | Installation - Main sewer pipe (install new) | DEFAULT_SEWER_SERVICE_8 |  | $7,000.00 |  |  |  |  |  | Expert sewer pipe installation service |
| Sewer and Septic > Installation > Sewer | Installation - Main sewer pipe (replace existing) | DEFAULT_SEWER_SERVICE_9 |  | $7,000.00 |  |  |  |  |  | Expert sewer pipe installation service |
| Sewer and Septic > Installation > Other | Installation - Something else / I don't know | DEFAULT_SEWER_SERVICE_10 |  | $7,000.00 |  |  |  |  |  | Expert septic system installation service |
| Sewer and Septic > Maintenance > Cleaning | Maintenance - Aerobic septic system | DEFAULT_SEWER_SERVICE_11 |  | $400.00 |  |  |  |  |  | Expert septic system cleaning service |
| Sewer and Septic > Maintenance > Cleaning | Maintenance - Conventional septic | DEFAULT_SEWER_SERVICE_12 |  | $400.00 |  |  |  |  |  | Expert septic system cleaning service |
| Sewer and Septic > Maintenance > Cleaning | Maintenance - Other septic system | DEFAULT_SEWER_SERVICE_13 |  | $400.00 |  |  |  |  |  | Expert septic system cleaning service |
| Sewer and Septic > Maintenance > Cleaning | Maintenance - Sewer clean out (preventive) | DEFAULT_SEWER_SERVICE_14 |  | $400.00 |  |  |  |  |  | Expert septic system cleaning service |
| Sewer and Septic > Maintenance > Cleaning | Maintenance - Sewer clean out (corrective) | DEFAULT_SEWER_SERVICE_15 |  | $400.00 |  |  |  |  |  | Expert sewer repair service |
| Sewer and Septic > Maintenance > Pumping | Maintenance - Aerobic septic system | DEFAULT_SEWER_SERVICE_16 |  | $400.00 |  |  |  |  |  | Expert septic system pumping service |
| Sewer and Septic > Maintenance > Pumping | Maintenance - Conventional septic | DEFAULT_SEWER_SERVICE_17 |  | $400.00 |  |  |  |  |  | Expert septic system pumping service |
| Sewer and Septic > Maintenance > Pumping | Maintenance - Other septic system | DEFAULT_SEWER_SERVICE_18 |  | $400.00 |  |  |  |  |  | Expert septic system pumping service |
| Sewer and Septic > Maintenance > Pumping | Maintenance - Pumping fuel surcharge | DEFAULT_SEWER_SERVICE_19 |  | $400.00 |  |  |  |  |  | Expert septic system pumping service |
| Sewer and Septic > Maintenance > Other | Maintenance - Something else / I don't know | DEFAULT_SEWER_SERVICE_20 |  | $400.00 |  |  |  |  |  | Expert septic system maintenance service |
| Sewer and Septic > Repair > Septic system | Repair - Aerobic septic system | DEFAULT_SEWER_SERVICE_21 |  | $1,200.00 |  |  |  |  |  | Expert septic system repair service |
| Sewer and Septic > Repair > Septic system | Repair - Conventional septic | DEFAULT_SEWER_SERVICE_22 |  | $1,200.00 |  |  |  |  |  | Expert septic system repair service |
| Sewer and Septic > Repair > Septic system | Repair - Other septic system | DEFAULT_SEWER_SERVICE_23 |  | $1,200.00 |  |  |  |  |  | Expert septic system repair service |
| Sewer and Septic > Repair > Sewer | Repair - Sewer clean out (corrective) | DEFAULT_SEWER_SERVICE_24 |  | $1,200.00 |  |  |  |  |  | Expert sewer repair service |

## Siding

- Services: **18** (18 with a task code, 0 without) in **3** categories (` > ` = nested subcategory): Siding > Installation > Siding, Siding > Replace > Siding, Siding > Repair > Siding
- Pricing insight available for 0 of 18 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Siding > Installation > Siding | Installation - Vinyl siding | DEFAULT_SIDING_SERVICE_1 |  | $200.00 |  |  |  |  |  | Expert vinyl siding installation |
| Siding > Installation > Siding | Installation - Brick & metal siding | DEFAULT_SIDING_SERVICE_2 |  | $200.00 |  |  |  |  |  | Expert brick & metal siding installation |
| Siding > Installation > Siding | Installation - Hardie board siding | DEFAULT_SIDING_SERVICE_3 |  | $200.00 |  |  |  |  |  | Expert hardie board siding installation |
| Siding > Installation > Siding | Installation - Wood siding | DEFAULT_SIDING_SERVICE_4 |  | $200.00 |  |  |  |  |  | Expert wood siding installation |
| Siding > Installation > Siding | Installation - Fiber cement siding | DEFAULT_SIDING_SERVICE_5 |  | $200.00 |  |  |  |  |  | Expert fiber cement siding installation |
| Siding > Installation > Siding | Installation - Other siding | DEFAULT_SIDING_SERVICE_6 |  | $200.00 |  |  |  |  |  | Expert siding installation |
| Siding > Replace > Siding | Replace - Vinyl siding | DEFAULT_SIDING_SERVICE_7 |  | $200.00 |  |  |  |  |  | Expert vinyl siding replacement |
| Siding > Replace > Siding | Replace - Brick & metal siding | DEFAULT_SIDING_SERVICE_8 |  | $200.00 |  |  |  |  |  | Expert brick & metal siding replacement |
| Siding > Replace > Siding | Replace - Hardie board siding | DEFAULT_SIDING_SERVICE_9 |  | $200.00 |  |  |  |  |  | Expert hardie board siding replacement |
| Siding > Replace > Siding | Replace - Wood siding | DEFAULT_SIDING_SERVICE_10 |  | $200.00 |  |  |  |  |  | Expert wood siding replacement |
| Siding > Replace > Siding | Replace - Fiber cement siding | DEFAULT_SIDING_SERVICE_11 |  | $200.00 |  |  |  |  |  | Expert fiber cement siding replacement |
| Siding > Replace > Siding | Replace - Other siding | DEFAULT_SIDING_SERVICE_12 |  | $200.00 |  |  |  |  |  | Expert siding replacement |
| Siding > Repair > Siding | Repair - Vinyl siding | DEFAULT_SIDING_SERVICE_13 |  | $200.00 |  |  |  |  |  | Expert vinyl siding repair |
| Siding > Repair > Siding | Repair - Brick & metal siding | DEFAULT_SIDING_SERVICE_14 |  | $200.00 |  |  |  |  |  | Expert brick & metal siding repair |
| Siding > Repair > Siding | Repair - Hardie board siding | DEFAULT_SIDING_SERVICE_15 |  | $200.00 |  |  |  |  |  | Expert hardie board siding repair |
| Siding > Repair > Siding | Repair - Wood siding | DEFAULT_SIDING_SERVICE_16 |  | $200.00 |  |  |  |  |  | Expert wood siding repair |
| Siding > Repair > Siding | Repair - Fiber cement siding | DEFAULT_SIDING_SERVICE_17 |  | $200.00 |  |  |  |  |  | Expert fiber cement siding repair |
| Siding > Repair > Siding | Repair - Other siding | DEFAULT_SIDING_SERVICE_18 |  | $200.00 |  |  |  |  |  | Expert other siding  repair |

## Smart Home

- Services: **34** (34 with a task code, 0 without) in **6** categories (` > ` = nested subcategory): Smart Home > Installation > Cameras and security, Smart Home > Installation > Wifi, Smart Home > Installation > Smart device, Smart Home > Repair > Cameras and security, Smart Home > Repair > Wifi, Smart Home > Repair > Smart device
- Pricing insight available for 0 of 34 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Smart Home > Installation > Cameras and security | Installation - Smart camera package | DEFAULT_GADGETS_SERVICE_1 |  | $300.00 |  |  |  |  |  | Expert smart cameras installation service |
| Smart Home > Installation > Cameras and security | Installation - Mailbox camera | DEFAULT_GADGETS_SERVICE_2 |  | $300.00 |  |  |  |  |  | Expert smart cameras installation service |
| Smart Home > Installation > Cameras and security | Installation - Video doorbell | DEFAULT_GADGETS_SERVICE_3 |  | $300.00 |  |  |  |  |  | Expert smart cameras installation service |
| Smart Home > Installation > Cameras and security | Installation - Smart lock | DEFAULT_GADGETS_SERVICE_4 |  | $300.00 |  |  |  |  |  | Expert smart lock installation service |
| Smart Home > Installation > Cameras and security | Installation - Motion sensor | DEFAULT_GADGETS_SERVICE_5 |  | $300.00 |  |  |  |  |  | Expert motion sensor installation service |
| Smart Home > Installation > Cameras and security | Installation - Security touch panel | DEFAULT_GADGETS_SERVICE_6 |  | $300.00 |  |  |  |  |  | Expert touch panel installation service |
| Smart Home > Installation > Cameras and security | Installation - Security TV screen | DEFAULT_GADGETS_SERVICE_7 |  | $300.00 |  |  |  |  |  | Expert security TV installation service |
| Smart Home > Installation > Wifi | Installation - Wifi system setup | DEFAULT_GADGETS_SERVICE_8 |  | $300.00 |  |  |  |  |  | Expert wifi system installation service |
| Smart Home > Installation > Wifi | Installation - Wifi network extendor | DEFAULT_GADGETS_SERVICE_9 |  | $300.00 |  |  |  |  |  | Expert wifi extendor installation service |
| Smart Home > Installation > Wifi | Installation - Wifi router | DEFAULT_GADGETS_SERVICE_10 |  | $300.00 |  |  |  |  |  | Expert wifi router installation service |
| Smart Home > Installation > Smart device | Installation - Smart blinds / shades | DEFAULT_GADGETS_SERVICE_11 |  | $300.00 |  |  |  |  |  | Expert smart shades installation service |
| Smart Home > Installation > Smart device | Installation - Smart home display/panel | DEFAULT_GADGETS_SERVICE_12 |  | $300.00 |  |  |  |  |  | Expert smart device installation service |
| Smart Home > Installation > Smart device | Installation - Smart speaker | DEFAULT_GADGETS_SERVICE_13 |  | $300.00 |  |  |  |  |  | Expert smart device installation service |
| Smart Home > Installation > Smart device | Installation - Smart lighting | DEFAULT_GADGETS_SERVICE_14 |  | $300.00 |  |  |  |  |  | Expert smart device installation service |
| Smart Home > Installation > Smart device | Installation - Smart thermostat | DEFAULT_GADGETS_SERVICE_15 |  | $300.00 |  |  |  |  |  | Expert smart device installation service |
| Smart Home > Installation > Smart device | Installation - Smart | DEFAULT_GADGETS_SERVICE_16 |  | $300.00 |  |  |  |  |  | Expert smart device installation service |
| Smart Home > Installation > Smart device | Installation - Other smart device | DEFAULT_GADGETS_SERVICE_17 |  | $300.00 |  |  |  |  |  | Expert smart device installation service |
| Smart Home > Repair > Cameras and security | Repair - Smart camera package | DEFAULT_GADGETS_SERVICE_18 |  | $200.00 |  |  |  |  |  | Expert smart cameras repair service |
| Smart Home > Repair > Cameras and security | Repair - Mailbox camera | DEFAULT_GADGETS_SERVICE_19 |  | $200.00 |  |  |  |  |  | Expert smart cameras repair service |
| Smart Home > Repair > Cameras and security | Repair - Video doorbell | DEFAULT_GADGETS_SERVICE_20 |  | $200.00 |  |  |  |  |  | Expert smart cameras repair service |
| Smart Home > Repair > Cameras and security | Repair - Smart lock | DEFAULT_GADGETS_SERVICE_21 |  | $200.00 |  |  |  |  |  | Expert smart lock repair service |
| Smart Home > Repair > Cameras and security | Repair - Motion sensor | DEFAULT_GADGETS_SERVICE_22 |  | $200.00 |  |  |  |  |  | Expert motion sensor repair service |
| Smart Home > Repair > Cameras and security | Repair - Security touch panel | DEFAULT_GADGETS_SERVICE_23 |  | $200.00 |  |  |  |  |  | Expert touch panel repair service |
| Smart Home > Repair > Cameras and security | Repair - Security TV screen | DEFAULT_GADGETS_SERVICE_24 |  | $200.00 |  |  |  |  |  | Expert security TV repair service |
| Smart Home > Repair > Wifi | Repair - Wifi system | DEFAULT_GADGETS_SERVICE_25 |  | $200.00 |  |  |  |  |  | Expert wifi system repair service |
| Smart Home > Repair > Wifi | Repair - Wifi network extendor | DEFAULT_GADGETS_SERVICE_26 |  | $200.00 |  |  |  |  |  | Expert wifi extendor repair service |
| Smart Home > Repair > Wifi | Repair - Wifi router | DEFAULT_GADGETS_SERVICE_27 |  | $200.00 |  |  |  |  |  | Expert wifi router repair service |
| Smart Home > Repair > Smart device | Repair - Smart blinds / shades | DEFAULT_GADGETS_SERVICE_28 |  | $300.00 |  |  |  |  |  | Expert smart shades repair service |
| Smart Home > Repair > Smart device | Repair - Smart home display/panel | DEFAULT_GADGETS_SERVICE_29 |  | $200.00 |  |  |  |  |  | Expert smart device repair service |
| Smart Home > Repair > Smart device | Repair - Smart speaker | DEFAULT_GADGETS_SERVICE_30 |  | $200.00 |  |  |  |  |  | Expert smart device repair service |
| Smart Home > Repair > Smart device | Repair - Smart lighting | DEFAULT_GADGETS_SERVICE_31 |  | $200.00 |  |  |  |  |  | Expert smart device repair service |
| Smart Home > Repair > Smart device | Repair - Smart thermostat | DEFAULT_GADGETS_SERVICE_32 |  | $200.00 |  |  |  |  |  | Expert smart device repair service |
| Smart Home > Repair > Smart device | Repair - Smart | DEFAULT_GADGETS_SERVICE_33 |  | $200.00 |  |  |  |  |  | Expert smart device repair service |
| Smart Home > Repair > Smart device | Repair - Other smart device | DEFAULT_GADGETS_SERVICE_34 |  | $200.00 |  |  |  |  |  | Expert smart device repair service |

## Snow Removal

- Services: **6** (6 with a task code, 0 without) in **2** categories (` > ` = nested subcategory): Snow Removal > Removal > Snow removal, Snow Removal > Removal > Other
- Pricing insight available for 0 of 6 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Snow Removal > Removal > Snow removal | Removal - Snow shoveling | DEFAULT_SNOW_REMOVAL_SERVICE_1 |  | $600.00 |  |  |  |  |  | Expert snow removal service |
| Snow Removal > Removal > Snow removal | Removal - Snow plowing | DEFAULT_SNOW_REMOVAL_SERVICE_2 |  | $600.00 |  |  |  |  |  | Expert snow removal service |
| Snow Removal > Removal > Snow removal | Removal - Snow blowing | DEFAULT_SNOW_REMOVAL_SERVICE_3 |  | $600.00 |  |  |  |  |  | Expert snow removal service |
| Snow Removal > Removal > Snow removal | Removal - Snow removal and hauling | DEFAULT_SNOW_REMOVAL_SERVICE_4 |  | $600.00 |  |  |  |  |  | Expert snow removal service |
| Snow Removal > Removal > Snow removal | Removal - Snow removal and banking | DEFAULT_SNOW_REMOVAL_SERVICE_5 |  | $600.00 |  |  |  |  |  | Expert snow removal service |
| Snow Removal > Removal > Other | Removal - Something else / I don't know | DEFAULT_SNOW_REMOVAL_SERVICE_6 |  | $600.00 |  |  |  |  |  | Expert snow removal service |

## Solar & Energy

- Services: **10** (10 with a task code, 0 without) in **6** categories (` > ` = nested subcategory): Solar & Energy > Installation > Solar, Solar & Energy > Installation > EV, Solar & Energy > Installation > Other, Solar & Energy > Repair > Solar, Solar & Energy > Repair > EV, Solar & Energy > Repair > Other
- Pricing insight available for 0 of 10 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Solar & Energy > Installation > Solar | Installation - Solar system | DEFAULT_SOLAR_SERVICE_1 |  | $800.00 |  |  |  |  |  | Expert installation service for solar system |
| Solar & Energy > Installation > Solar | Installation - Solar inverter | DEFAULT_SOLAR_SERVICE_2 |  | $800.00 |  |  |  |  |  | Expert installation service for solar inverter |
| Solar & Energy > Installation > Solar | Installation - Solar Panel | DEFAULT_SOLAR_SERVICE_3 |  | $800.00 |  |  |  |  |  | Expert installation service for solar panel |
| Solar & Energy > Installation > EV | Installation - Electric vehicle (EV) charging station | DEFAULT_SOLAR_SERVICE_4 |  | $800.00 |  |  |  |  |  | Expert installation service for electric vehicle (EV) charging station |
| Solar & Energy > Installation > Other | Installation - Something else / I don't know | DEFAULT_SOLAR_SERVICE_5 |  | $800.00 |  |  |  |  |  | Expert installation service for solar systems |
| Solar & Energy > Repair > Solar | Repair - Solar system | DEFAULT_SOLAR_SERVICE_6 |  | $800.00 |  |  |  |  |  | Expert repair service for solar system |
| Solar & Energy > Repair > Solar | Repair - Solar inverter | DEFAULT_SOLAR_SERVICE_7 |  | $800.00 |  |  |  |  |  | Expert repair service for solar inverter |
| Solar & Energy > Repair > Solar | Repair - Solar Panel | DEFAULT_SOLAR_SERVICE_8 |  | $800.00 |  |  |  |  |  | Expert repair service for solar panel |
| Solar & Energy > Repair > EV | Repair - Electric vehicle (EV) charging station | DEFAULT_SOLAR_SERVICE_9 |  | $800.00 |  |  |  |  |  | Expert repair service for electric vehicle (EV) charging station |
| Solar & Energy > Repair > Other | Repair - Something else / I don't know | DEFAULT_SOLAR_SERVICE_10 |  | $800.00 |  |  |  |  |  | Expert repair service for solar systems |

## Tax Planner

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Tax planner > Tax planner > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Tax planner > Tax planner > General request | Tax planner - Book an appointment | DEFAULT_TAX_PLANNER_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Tech Help

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Tech help > Tech help > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Tech help > Tech help > General request | Tech help - Book an appointment | DEFAULT_DEVICES_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Transportation

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Transportation > Transportation > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Transportation > Transportation > General request | Transportation - Book an appointment | DEFAULT_TRANSPORTATION_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Device Repair

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Device repair > Device repair > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Device repair > Device repair > General request | Device repair - Book an appointment | DEFAULT_DEVICE_REPAIR_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Tile & Grout

- Services: **2** (0 with a task code, 2 without) in **2** categories (` > ` = nested subcategory): Custom Services, Consultation
- Pricing insight available for 0 of 2 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Custom Services | Custom Job |  |  | $0.00 |  |  |  |  | yes | Pro will provide you a quote if the work you need does not fit into one of our standard categories. / Please provide as much detail as possible, including pictures. |
| Consultation | Tile Design Consultation |  |  | $0.00 |  |  |  |  | yes | Professional will meet you at your home to discuss the scope of work.  Designer will consult on product selection, drawing of design layout. |

## Tree Services

- Services: **14** (14 with a task code, 0 without) in **7** categories (` > ` = nested subcategory): Tree Services > Removal > Bushes and shrubs, Tree Services > Removal > Stumps, Tree Services > Removal > Tree, Tree Services > Removal > Other, Tree Services > Treatment > Bushes and shrubs, Tree Services > Treatment > Tree, Tree Services > Treatment > Other
- Pricing insight available for 0 of 14 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Tree Services > Removal > Bushes and shrubs | Removal - 1 Bush / shrub | DEFAULT_TREE_SERVICES_SERVICE_1 |  | $800.00 |  |  |  |  |  | Expert bush removal service |
| Tree Services > Removal > Bushes and shrubs | Removal - 2+ Bushes / shrubs | DEFAULT_TREE_SERVICES_SERVICE_2 |  | $800.00 |  |  |  |  |  | Expert bush removal service |
| Tree Services > Removal > Stumps | Removal - 1 stump | DEFAULT_TREE_SERVICES_SERVICE_3 |  | $800.00 |  |  |  |  |  | Expert stump removal service |
| Tree Services > Removal > Stumps | Removal - 2+ stumps | DEFAULT_TREE_SERVICES_SERVICE_4 |  | $800.00 |  |  |  |  |  | Expert stump removal service |
| Tree Services > Removal > Tree | Removal - Emergency removal | DEFAULT_TREE_SERVICES_SERVICE_5 |  | $800.00 |  |  |  |  |  | Expert emergency tree/stump removal service |
| Tree Services > Removal > Tree | Removal - Sick tree | DEFAULT_TREE_SERVICES_SERVICE_6 |  | $800.00 |  |  |  |  |  | Expert sick tree removal service |
| Tree Services > Removal > Tree | Removal - 1 Tree | DEFAULT_TREE_SERVICES_SERVICE_7 |  | $800.00 |  |  |  |  |  | Expert tree removal service |
| Tree Services > Removal > Tree | Removal - 2 Trees | DEFAULT_TREE_SERVICES_SERVICE_8 |  | $800.00 |  |  |  |  |  | Expert tree removal service |
| Tree Services > Removal > Other | Removal - Something else / I don't know | DEFAULT_TREE_SERVICES_SERVICE_9 |  | $800.00 |  |  |  |  |  | Expert tree/stump removal service |
| Tree Services > Treatment > Bushes and shrubs | Treatment - Bush / shrub trimming | DEFAULT_TREE_SERVICES_SERVICE_10 |  | $800.00 |  |  |  |  |  | Expert bush trimming service |
| Tree Services > Treatment > Bushes and shrubs | Treatment - Bush / shrub pruning | DEFAULT_TREE_SERVICES_SERVICE_11 |  | $800.00 |  |  |  |  |  | Expert bush pruning service |
| Tree Services > Treatment > Tree | Treatment - Tree trimming | DEFAULT_TREE_SERVICES_SERVICE_12 |  | $800.00 |  |  |  |  |  | Expert tree trimming service |
| Tree Services > Treatment > Tree | Treatment - Tree pruning | DEFAULT_TREE_SERVICES_SERVICE_13 |  | $800.00 |  |  |  |  |  | Expert tree pruning service |
| Tree Services > Treatment > Other | Treatment - Something else / I don't know | DEFAULT_TREE_SERVICES_SERVICE_14 |  | $800.00 |  |  |  |  |  | Expert tree/stump service |

## Tutoring

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Tutoring > Tutoring > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Tutoring > Tutoring > General request | Tutoring - Book an appointment | DEFAULT_TUTORING_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Water Heater

- Services: **10** (0 with a task code, 10 without) in **2** categories (` > ` = nested subcategory): Custom Services, Water Heater
- Pricing insight available for 0 of 10 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Custom Services | Custom Job |  |  | $0.00 |  |  |  |  | yes | Pro will provide you a quote if the work you need does not fit into one of our standard categories. / Please provide as much detail as possible, including pictures. |
| Water Heater | Water heater repair |  |  | $0.00 |  |  |  |  | yes | Repairs on any make or any model, no hourly fees. / Rent a new water heater for as little as $14.99 per month and never pay a repair bill again. |
| Water Heater | No hot water |  |  | $0.00 |  |  |  |  | yes | Our skilled technicians service or repair any brand of water heater. We will visit your home and diagnose your problem. No hourly fees. / We'll tell you how much your service will cost before we undertake any repairs, and your price will be based on a straightforward pricing list. |
| Water Heater | Water not hot enough |  |  | $0.00 |  |  |  |  | yes | Our skilled technicians service or repair any brand of water heater. We will visit your home and diagnose your problem. No hourly fees. / We'll tell you how much your service will cost before we undertake any repairs, and your price will be based on a straightforward pricing list. |
| Water Heater | Water too hot |  |  | $0.00 |  |  |  |  | yes | Our skilled technicians service or repair any brand of water heater. We will visit your home and diagnose your problem. No hourly fees. / We'll tell you how much your service will cost before we undertake any repairs, and your price will be based on a straightforward pricing list. |
| Water Heater | Noise |  |  | $0.00 |  |  |  |  | yes | Our skilled technicians service or repair any brand of water heater. We will visit your home and diagnose your problem. No hourly fees. / We'll tell you how much your service will cost before we undertake any repairs, and your price will be based on a straightforward pricing list. |
| Water Heater | Leaking |  |  | $0.00 |  |  |  |  | yes | Our skilled technicians service or repair any brand of water heater. We will visit your home and diagnose your problem. No hourly fees. / We'll tell you how much your service will cost before we undertake any repairs, and your price will be based on a straightforward pricing list. |
| Water Heater | Water condition |  |  | $0.00 |  |  |  |  | yes | Our skilled technicians service or repair any brand of water heater. We will visit your home and diagnose your problem. No hourly fees. / We'll tell you how much your service will cost before we undertake any repairs, and your price will be based on a straightforward pricing list. |
| Water Heater | Not enough water pressure |  |  | $0.00 |  |  |  |  | yes | Our skilled technicians service or repair any brand of water heater. We will visit your home and diagnose your problem. No hourly fees. / We'll tell you how much your service will cost before we undertake any repairs, and your price will be based on a straightforward pricing list. |
| Water Heater | No hot water |  |  | $0.00 |  |  |  |  | yes | Our skilled technicians will diagnose the problem, and repair your water heater. |

## Water Transfer Printing

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Water transfer printing > Water transfer printing > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Water transfer printing > Water transfer printing > General request | Water transfer printing - Book an appointment | DEFAULT_WATER_TRANSFER_PRINTING_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Water Treatment

- Services: **29** (29 with a task code, 0 without) in **8** categories (` > ` = nested subcategory): Water Treatment > Diagnostic > Well, Water Treatment > Diagnostic > Odor in water, Water Treatment > Installation > Systems and equipment, Water Treatment > Installation > Well, Water Treatment > Installation > Other, Water Treatment > Repair > Systems and equipment, Water Treatment > Repair > Well, Water Treatment > Repair > Other
- Pricing insight available for 0 of 29 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Water Treatment > Diagnostic > Well | Diagnostic - Well inspection | DEFAULT_WATER_TREATMENT_SERVICE_1 |  | $400.00 |  |  |  |  |  | Expert well diagnostic service |
| Water Treatment > Diagnostic > Odor in water | Diagnostic - Foul odor | DEFAULT_WATER_TREATMENT_SERVICE_2 |  | $400.00 |  |  |  |  |  | Expert water diagnostic service |
| Water Treatment > Diagnostic > Odor in water | Diagnostic - Other | DEFAULT_WATER_TREATMENT_SERVICE_3 |  | $400.00 |  |  |  |  |  | Expert water diagnostic service |
| Water Treatment > Installation > Systems and equipment | Installation - Carbon filtration | DEFAULT_WATER_TREATMENT_SERVICE_4 |  | $350.00 |  |  |  |  |  | Expert water treatment systems installation service |
| Water Treatment > Installation > Systems and equipment | Installation - Constant pressure | DEFAULT_WATER_TREATMENT_SERVICE_5 |  | $350.00 |  |  |  |  |  | Expert water treatment systems installation service |
| Water Treatment > Installation > Systems and equipment | Installation - Exterior water supply | DEFAULT_WATER_TREATMENT_SERVICE_6 |  | $350.00 |  |  |  |  |  | Expert water treatment systems installation service |
| Water Treatment > Installation > Systems and equipment | Installation - Pressure tank | DEFAULT_WATER_TREATMENT_SERVICE_7 |  | $350.00 |  |  |  |  |  | Expert water treatment systems installation service |
| Water Treatment > Installation > Systems and equipment | Installation - Reverse osmosis (under sink) | DEFAULT_WATER_TREATMENT_SERVICE_8 |  | $350.00 |  |  |  |  |  | Expert water treatment systems installation service |
| Water Treatment > Installation > Systems and equipment | Installation - Reverse osmosis (whole house) | DEFAULT_WATER_TREATMENT_SERVICE_9 |  | $350.00 |  |  |  |  |  | Expert water treatment systems installation service |
| Water Treatment > Installation > Systems and equipment | Installation - Sulfur | DEFAULT_WATER_TREATMENT_SERVICE_10 |  | $350.00 |  |  |  |  |  | Expert water treatment systems installation service |
| Water Treatment > Installation > Systems and equipment | Installation - Water softener | DEFAULT_WATER_TREATMENT_SERVICE_11 |  | $350.00 |  |  |  |  |  | Expert water treatment systems installation service |
| Water Treatment > Installation > Well | Installation - Water/well pump | DEFAULT_WATER_TREATMENT_SERVICE_12 |  | $350.00 |  |  |  |  |  | Expert well pump installation service |
| Water Treatment > Installation > Well | Installation - Chlorination | DEFAULT_WATER_TREATMENT_SERVICE_13 |  | $350.00 |  |  |  |  |  | Expert well pump chlorination service |
| Water Treatment > Installation > Well | Installation - Drill new | DEFAULT_WATER_TREATMENT_SERVICE_14 |  | $350.00 |  |  |  |  |  | Expert well installation service |
| Water Treatment > Installation > Well | Installation - Well | DEFAULT_WATER_TREATMENT_SERVICE_15 |  | $350.00 |  |  |  |  |  | Expert well installation service |
| Water Treatment > Installation > Other | Installation - Something else / I don't know | DEFAULT_WATER_TREATMENT_SERVICE_16 |  | $350.00 |  |  |  |  |  | Expert water treatment service |
| Water Treatment > Repair > Systems and equipment | Repair - Carbon filtration | DEFAULT_WATER_TREATMENT_SERVICE_17 |  | $350.00 |  |  |  |  |  | Expert water treatment systems repair service |
| Water Treatment > Repair > Systems and equipment | Repair - Constant pressure | DEFAULT_WATER_TREATMENT_SERVICE_18 |  | $350.00 |  |  |  |  |  | Expert water treatment systems repair service |
| Water Treatment > Repair > Systems and equipment | Repair - Exterior water supply | DEFAULT_WATER_TREATMENT_SERVICE_19 |  | $350.00 |  |  |  |  |  | Expert water treatment systems repair service |
| Water Treatment > Repair > Systems and equipment | Repair - Pressure tank | DEFAULT_WATER_TREATMENT_SERVICE_20 |  | $350.00 |  |  |  |  |  | Expert water treatment systems repair service |
| Water Treatment > Repair > Systems and equipment | Repair - Reverse osmosis system (under sink) | DEFAULT_WATER_TREATMENT_SERVICE_21 |  | $350.00 |  |  |  |  |  | Expert water treatment systems repair service |
| Water Treatment > Repair > Systems and equipment | Repair - Reverse osmosis system (whole house) | DEFAULT_WATER_TREATMENT_SERVICE_22 |  | $350.00 |  |  |  |  |  | Expert water treatment systems repair service |
| Water Treatment > Repair > Systems and equipment | Repair - Softener rebed | DEFAULT_WATER_TREATMENT_SERVICE_23 |  | $350.00 |  |  |  |  |  | Expert water treatment systems repair service |
| Water Treatment > Repair > Systems and equipment | Repair - Sulfur | DEFAULT_WATER_TREATMENT_SERVICE_24 |  | $350.00 |  |  |  |  |  | Expert water treatment systems repair service |
| Water Treatment > Repair > Systems and equipment | Repair - Water softener | DEFAULT_WATER_TREATMENT_SERVICE_25 |  | $350.00 |  |  |  |  |  | Expert water treatment systems repair service |
| Water Treatment > Repair > Well | Repair - Water/well pump | DEFAULT_WATER_TREATMENT_SERVICE_26 |  | $350.00 |  |  |  |  |  | Expert well pump repair service |
| Water Treatment > Repair > Well | Repair - Chlorination | DEFAULT_WATER_TREATMENT_SERVICE_27 |  | $350.00 |  |  |  |  |  | Expert well repair service |
| Water Treatment > Repair > Well | Repair - Well | DEFAULT_WATER_TREATMENT_SERVICE_28 |  | $350.00 |  |  |  |  |  | Expert well repair service |
| Water Treatment > Repair > Other | Repair - Something else / I don't know | DEFAULT_WATER_TREATMENT_SERVICE_29 |  | $350.00 |  |  |  |  |  | Expert water treatment service |

## Well Pumps

- Services: **1** (0 with a task code, 1 without) in **1** category (` > ` = nested subcategory): Custom Services
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Custom Services | Custom Job |  |  | $0.00 |  |  |  |  | yes | Pro will provide you a quote if the work you need does not fit into one of our standard categories. / Please provide as much detail as possible, including pictures. |

## Wildlife Control

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Wildlife control > Wildlife control > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Wildlife control > Wildlife control > General request | Wildlife control - Book an appointment | DEFAULT_WILDLIFE_CONTROL_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Windows

- Services: **8** (8 with a task code, 0 without) in **8** categories (` > ` = nested subcategory): Windows > Installation > New, Windows > Installation > Replace, Windows > Installation > Glass, Windows > Installation > Other, Windows > Repair > Broken window, Windows > Repair > Replace, Windows > Repair > Glass, Windows > Repair > Other
- Pricing insight available for 0 of 8 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Windows > Installation > New | Installation - Windows (install new only) | DEFAULT_WINDOWS_SERVICE_1 |  | $250.00 |  |  |  |  |  | Expert window installation service |
| Windows > Installation > Replace | Installation - Windows (install new and replace old) | DEFAULT_WINDOWS_SERVICE_2 |  | $250.00 |  |  |  |  |  | Expert window installation service |
| Windows > Installation > Glass | Installation - Window glass | DEFAULT_WINDOWS_SERVICE_3 |  | $250.00 |  |  |  |  |  | Expert window glass installation service |
| Windows > Installation > Other | Installation - Something else / I don't know | DEFAULT_WINDOWS_SERVICE_4 |  | $250.00 |  |  |  |  |  | Expert window installation service |
| Windows > Repair > Broken window | Repair - Windows | DEFAULT_WINDOWS_SERVICE_5 |  | $250.00 |  |  |  |  |  | Expert window repair service |
| Windows > Repair > Replace | Repair - Windows (install new and replace old) | DEFAULT_WINDOWS_SERVICE_6 |  | $250.00 |  |  |  |  |  | Expert window repair service |
| Windows > Repair > Glass | Repair - Window glass | DEFAULT_WINDOWS_SERVICE_7 |  | $250.00 |  |  |  |  |  | Expert window glass installation service |
| Windows > Repair > Other | Repair - Something else / I don't know | DEFAULT_WINDOWS_SERVICE_8 |  | $250.00 |  |  |  |  |  | Expert window installation service |

## Wine

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Wine > Wine > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Wine > Wine > General request | Wine - Book an appointment | DEFAULT_WINE_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Detailing

- **Empty book**: adding this industry created the industry card but seeded **no categories and no services** (the API returned zero categories).

## Generator

- **Empty book**: adding this industry created the industry card but seeded **no categories and no services** (the API returned zero categories).

## Construction & Remodeling

- **Empty book**: adding this industry created the industry card but seeded **no categories and no services** (the API returned zero categories).

## Caulking & Sealants

- Services: **1** (1 with a task code, 0 without) in **1** category (` > ` = nested subcategory): Caulking & sealants > Caulking & sealants > General request
- Pricing insight available for 0 of 1 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Caulking & sealants > Caulking & sealants > General request | Caulking & sealants - Book an appointment | DEFAULT_CAULKING_AND_SEALANTS_SERVICE_1 |  | $100.00 |  |  |  |  |  | Book an appoint now! |

## Insulation

- Services: **20** (20 with a task code, 0 without) in **10** categories (` > ` = nested subcategory): Insulation > Installation > Blanket, Insulation > Installation > Foam, Insulation > Installation > Blown in, Insulation > Installation > Barriers, Insulation > Installation > Other, Insulation > Removal > Blanket, Insulation > Removal > Foam, Insulation > Removal > Blown in, Insulation > Removal > Barriers, Insulation > Removal > Other
- Pricing insight available for 0 of 20 services

| Category | Service | Task code | Unit | Base | P25 | Median | P75 | Dur | OB | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Insulation > Installation > Blanket | Installation - Batt insulation | DEFAULT_INSULATION_SERVICE_1 |  | $200.00 |  |  |  |  |  | Expert batt insulation instalation service |
| Insulation > Installation > Blanket | Installation - Rolled insulation | DEFAULT_INSULATION_SERVICE_2 |  | $200.00 |  |  |  |  |  | Expert rolled insulation instalation service |
| Insulation > Installation > Foam | Installation - Foam board insulation | DEFAULT_INSULATION_SERVICE_3 |  | $200.00 |  |  |  |  |  | Expert foam board instalation service |
| Insulation > Installation > Foam | Installation - Spray foam (closed cell) | DEFAULT_INSULATION_SERVICE_4 |  | $200.00 |  |  |  |  |  | Expert spray foam instalation service |
| Insulation > Installation > Foam | Installation - Spray foam (open cell) | DEFAULT_INSULATION_SERVICE_5 |  | $200.00 |  |  |  |  |  | Expert spray foam instalation service |
| Insulation > Installation > Blown in | Installation - Blown in cellulose | DEFAULT_INSULATION_SERVICE_6 |  | $200.00 |  |  |  |  |  | Expert blown in instalation service |
| Insulation > Installation > Blown in | Installation - Blown in fiberglass | DEFAULT_INSULATION_SERVICE_7 |  | $200.00 |  |  |  |  |  | Expert blown in instalation service |
| Insulation > Installation > Barriers | Installation - Radiant barriers | DEFAULT_INSULATION_SERVICE_8 |  | $200.00 |  |  |  |  |  | Expert radiant barriers instalation service |
| Insulation > Installation > Barriers | Installation - Vapor barriers | DEFAULT_INSULATION_SERVICE_9 |  | $200.00 |  |  |  |  |  | Expert vapor barriers instalation service |
| Insulation > Installation > Other | Installation - Something else / I don't know | DEFAULT_INSULATION_SERVICE_10 |  | $200.00 |  |  |  |  |  | Expert insulation instalation service |
| Insulation > Removal > Blanket | Removal - Batt insulation | DEFAULT_INSULATION_SERVICE_11 |  | $200.00 |  |  |  |  |  | Expert batt insulation removal service |
| Insulation > Removal > Blanket | Removal - Rolled insulation | DEFAULT_INSULATION_SERVICE_12 |  | $200.00 |  |  |  |  |  | Expert rolled insulation removal service |
| Insulation > Removal > Foam | Removal - Foam board insulation | DEFAULT_INSULATION_SERVICE_13 |  | $200.00 |  |  |  |  |  | Expert foam board removal service |
| Insulation > Removal > Foam | Removal - Spray foam (closed cell) | DEFAULT_INSULATION_SERVICE_14 |  | $200.00 |  |  |  |  |  | Expert spray foam removal service |
| Insulation > Removal > Foam | Removal - Spray foam (open cell) | DEFAULT_INSULATION_SERVICE_15 |  | $200.00 |  |  |  |  |  | Expert spray foam removal service |
| Insulation > Removal > Blown in | Removal - Blown in cellulose | DEFAULT_INSULATION_SERVICE_16 |  | $200.00 |  |  |  |  |  | Expert blown in removal service |
| Insulation > Removal > Blown in | Removal - Blown in fiberglass | DEFAULT_INSULATION_SERVICE_17 |  | $200.00 |  |  |  |  |  | Expert blown in removal service |
| Insulation > Removal > Barriers | Removal - Radiant barriers | DEFAULT_INSULATION_SERVICE_18 |  | $200.00 |  |  |  |  |  | Expert radiant barriers removal service |
| Insulation > Removal > Barriers | Removal - Vapor barriers | DEFAULT_INSULATION_SERVICE_19 |  | $200.00 |  |  |  |  |  | Expert vapor barriers removal service |
| Insulation > Removal > Other | Removal - Something else / I don't know | DEFAULT_INSULATION_SERVICE_20 |  | $200.00 |  |  |  |  |  | Expert removal instalation service |

