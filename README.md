# Elektros kainos skaičiuoklė / Electricity Price Calculator

**Live:** https://task.lijana-lubyte.workers.dev/

[English](#english) · [Lietuviškai](#lietuviškai)

---

## English

A web tool that calculates the Nord Pool Day-Ahead electricity price (EUR/MWh) where the aggregated supply and demand
curves cross, for every trading period (hour) in an uploaded CSV file.

### How to use

1. Open https://task.lijana-lubyte.workers.dev/.
2. Drag a CSV file onto the upload area, or click **pasirinkite jį kompiuteryje** to pick one.
3. Read the results:
   - **Summary tiles**: number of periods, average price, minimum and maximum price with the hour they occur in, and
     total volume. Click the minimum or maximum tile to open that hour.
   - **Hourly price chart**: one bar per hour. Click a bar to open that hour.
   - **Results table**: date, area, hour, CET time period, price and volume. Click a row to open that hour.
   - **Curve chart**: supply, demand and the crossing point for the selected hour. Pick another hour from the dropdown.
     Untick **Priartinti susikirtimo tašką** to see the whole curve.
4. Click **Atsisiųsti rezultatus (CSV)** to download the results.
5. To check another file, drop it onto the upload area again.

The file is processed in your browser and is not sent anywhere.

### Input file

The same structure as `AggregatedOrder_2023-01-01_PriceCurves_BALTIC.csv` from the task:

```
DeliveryDateCET,Area,SupplyDemand,HourIndex_1_25,StartTimeUTC,SeqNr,Qty_MWH,PriceAmount_EUR
```

- `SupplyDemand` is `S` (supply) or `D` (demand).
- Files with several dates or areas are split into separate periods; 23- and 25-hour clock-change days work.
- `;` or tab separators with decimal commas (an Excel export) also work.
- Rows without a valid quantity or price are skipped and counted in a message; a file with missing columns shows an
  error.

### How the price is calculated

For each period, curve points are joined in `SeqNr` order with straight lines, the way Nord Pool draws its curves.
Excess supply `S(p) − D(p)` only grows as price rises, so the price is where it crosses zero: exactly on a curve step,
or interpolated between two neighbouring price points. If demand still exceeds supply at the maximum price, the
maximum price is reported; in the opposite case, the minimum price. The logic is in [`js/clearing.js`](js/clearing.js).

### Technologies

| Component     | What it does                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| HTML, CSS, JS | Static page with plain JavaScript (ES modules), no frameworks and no build step                         |
| SVG           | Charts drawn directly in the browser, no chart library                                                  |
| Open Sans     | Font loaded from Google Fonts                                                                           |
| GitHub        | Source code; changes go through pull requests into `main`                                               |
| Cloudflare    | Serves the static files on `workers.dev` and redeploys automatically on every push to `main` in GitHub  |
| Code checks   | ESLint, Stylelint, html-validate, Prettier and Node.js unit tests, run locally before each pull request |

### Run locally

ES modules don't load from `file://`, so serve the folder with any static server:

```
npx serve .
```

---

## Lietuviškai

Internetinis įrankis, kuris kiekvienam įkelto CSV dokumento prekybos laikotarpiui (kiekvienai valandai) apskaičiuoja
Nord Pool Day-Ahead elektros energijos kainą (EUR/MWh) suminių pasiūlos ir paklausos kreivių susikirtimo taške.

### Kaip naudotis

1. Atidarykite https://task.lijana-lubyte.workers.dev/.
2. Nutempkite CSV failą į įkėlimo laukelį arba spauskite **pasirinkite jį kompiuteryje**.
3. Peržiūrėkite rezultatus:
   - **Suvestinė**: prekybos laikotarpių skaičius, vidutinė kaina, mažiausia ir didžiausia kaina su valanda, kada ji
     buvo, ir bendras kiekis. Paspaudę mažiausios ar didžiausios kainos langelį, atidarysite tą valandą.
   - **Valandinės kainos grafikas**: viena juosta kiekvienai valandai. Paspaudę juostą, atidarysite tą valandą.
   - **Rezultatų lentelė**: data, zona, valanda, prekybos laikotarpis (CET), kaina ir kiekis. Paspaudę eilutę,
     atidarysite tą valandą.
   - **Kreivių grafikas**: pasirinktos valandos pasiūla, paklausa ir susikirtimo taškas. Kitą valandą pasirinkite iš
     sąrašo. Nuėmę varnelę **Priartinti susikirtimo tašką**, matysite visą kreivę.
4. Spauskite **Atsisiųsti rezultatus (CSV)**, kad atsisiųstumėte rezultatus.
5. Norėdami patikrinti kitą failą, vėl nutempkite jį į įkėlimo laukelį.

Failas apdorojamas jūsų naršyklėje ir niekur nesiunčiamas.

### Įkeliamas failas

Tokios pačios struktūros kaip užduoties `AggregatedOrder_2023-01-01_PriceCurves_BALTIC.csv`:

```
DeliveryDateCET,Area,SupplyDemand,HourIndex_1_25,StartTimeUTC,SeqNr,Qty_MWH,PriceAmount_EUR
```

- `SupplyDemand` yra `S` (pasiūla) arba `D` (paklausa).
- Failai su keliomis datomis ar zonomis skaidomi į atskirus laikotarpius; tinka ir 23 bei 25 valandų laiko keitimo
  dienos.
- Tinka ir `;` ar tabuliacijos skyrikliai su dešimtainiu kableliu (Excel eksportas).
- Eilutės be tinkamo kiekio ar kainos praleidžiamos ir parodomas pranešimas; jei trūksta stulpelių, rodoma klaida.

### Kaip apskaičiuojama kaina

Kiekvienam laikotarpiui kreivių taškai imami pagal `SeqNr` eilę ir sujungiami tiesėmis, kaip Nord Pool braižo savo
kreives. Kainai kylant pasiūlos perteklius `S(p) − D(p)` tik didėja, todėl kaina yra ten, kur jis lygus nuliui:
tiksliai ant kreivės laiptelio arba tiesiškai interpoliuota tarp dviejų gretimų kainos taškų. Jei esant didžiausiai
kainai paklausa vis dar viršija pasiūlą, pateikiama didžiausia kaina; priešingu atveju – mažiausia. Skaičiavimas yra
faile [`js/clearing.js`](js/clearing.js).

### Technologijos

| Komponentas   | Paskirtis                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| HTML, CSS, JS | Statinis puslapis su grynu JavaScript (ES moduliai), be karkasų ir be kompiliavimo žingsnio                             |
| SVG           | Grafikai braižomi tiesiai naršyklėje, be grafikų bibliotekos                                                            |
| Open Sans     | Šriftas iš Google Fonts                                                                                                 |
| GitHub        | Kodo saugykla; pakeitimai į `main` patenka per pull request                                                             |
| Cloudflare    | Talpina statinius failus `workers.dev` adresu ir automatiškai atnaujina svetainę po kiekvieno `main` pakeitimo GitHub'e |
| Kodo patikra  | ESLint, Stylelint, html-validate, Prettier ir Node.js vienetų testai, paleidžiami lokaliai prieš kiekvieną pull request |

### Paleidimas lokaliai

ES moduliai neįsikelia iš `file://`, todėl aplanką paleiskite per bet kokį statinį serverį:

```
npx serve .
```
