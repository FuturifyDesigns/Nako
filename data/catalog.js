/**
 * Botswana route guide for Nako phase one.
 * Corridor shapes are wayfinding approximations, not an official survey.
 * Numbered Gaborone routes follow public descriptions from YourBotswana
 * and visitor guides (Broadhurst 1, 2 and 5, Tlokweng 4, 5 and 6,
 * Kgale View 3, Mogoditshane Block 6 route 8). Phase 4 is carried as
 * Mogoditshane route 7. Coaches leave the Gaborone bus rank for the
 * towns listed by public transport guides. Associations can correct
 * any path from the dashboard.
 */

const pt = (lat, lng) => ({ lat, lng });

function line(pairs) {
  return pairs.map(([lat, lng]) => pt(lat, lng));
}

function around(lat, lng) {
  return line([
    [lat, lng],
    [lat + 0.006, lng + 0.004],
    [lat + 0.002, lng + 0.01],
    [lat - 0.005, lng + 0.006]
  ]);
}

function taxi(id, name, lat, lng, summary) {
  return {
    id,
    name,
    transport_type: "taxi",
    zone_id: null,
    origin_name: name,
    destination_name: "Local trips",
    summary,
    guide: true,
    path: around(lat, lng)
  };
}

function coach(id, name, originName, destName, path, summary) {
  return {
    id,
    name,
    transport_type: "bus",
    zone_id: null,
    origin_name: originName,
    destination_name: destName,
    summary,
    guide: true,
    path
  };
}

const gabsBus = pt(-24.6625, 25.9185);

export const catalog = {
  version: 1,
  aliases: [
    { q: "gabs", placeId: "gaborone", label: "Gaborone", lat: -24.6282, lng: 25.9231 },
    { q: "main mall", placeId: "gaborone", zoneId: "gaborone-central", label: "Main Mall", lat: -24.6468, lng: 25.9088 },
    { q: "station", placeId: "gaborone", zoneId: "gaborone-central", label: "Station", lat: -24.6548, lng: 25.9078 },
    { q: "bus rank", placeId: "gaborone", zoneId: "gaborone-central", label: "Bus rank", lat: -24.6625, lng: 25.9185 },
    { q: "rail park", placeId: "gaborone", zoneId: "gaborone-central", label: "Rail Park", lat: -24.661, lng: 25.916 },
    { q: "princess marina", placeId: "gaborone", zoneId: "gaborone-central", label: "Princess Marina Hospital", lat: -24.6562, lng: 25.9235 },
    { q: "marina", placeId: "gaborone", zoneId: "gaborone-central", label: "Princess Marina Hospital", lat: -24.6562, lng: 25.9235 },
    { q: "university of botswana", placeId: "gaborone", zoneId: "gaborone-central", label: "University of Botswana", lat: -24.6575, lng: 25.938 },
    { q: "ub", placeId: "gaborone", zoneId: "gaborone-central", label: "University of Botswana", lat: -24.6575, lng: 25.938 },
    { q: "bontleng", placeId: "gaborone", zoneId: "gaborone-central", label: "Bontleng", lat: -24.667, lng: 25.917 },
    { q: "white city", placeId: "gaborone", zoneId: "gaborone-central", label: "White City", lat: -24.662, lng: 25.921 },
    { q: "village", placeId: "gaborone", zoneId: "gaborone-central", label: "The Village", lat: -24.668, lng: 25.91 },
    { q: "ledumang", placeId: "gaborone", zoneId: "gaborone-central", label: "Ledumang", lat: -24.643, lng: 25.888 },
    { q: "extension 14", placeId: "gaborone", zoneId: "gaborone-central", label: "Extension 14", lat: -24.64, lng: 25.882 },
    { q: "broadhurst", placeId: "gaborone", zoneId: "gaborone-east", label: "Broadhurst", lat: -24.623, lng: 25.952 },
    { q: "tlokweng", placeId: "gaborone", zoneId: "gaborone-east", label: "Tlokweng", lat: -24.678, lng: 25.978 },
    { q: "riverwalk", placeId: "gaborone", zoneId: "gaborone-east", label: "Riverwalk", lat: -24.6475, lng: 25.9465 },
    { q: "river walk", placeId: "gaborone", zoneId: "gaborone-east", label: "Riverwalk", lat: -24.6475, lng: 25.9465 },
    { q: "phakalane", placeId: "gaborone", zoneId: "gaborone-east", label: "Phakalane", lat: -24.572, lng: 25.985 },
    { q: "gaborone north", placeId: "gaborone", zoneId: "gaborone-east", label: "Gaborone North", lat: -24.605, lng: 25.94 },
    { q: "oodi", placeId: "gaborone", zoneId: "gaborone-east", label: "Oodi", lat: -24.568, lng: 26.035 },
    { q: "airport", placeId: "gaborone", zoneId: "gaborone-east", label: "Sir Seretse Khama Airport", lat: -24.5552, lng: 25.9185 },
    { q: "sir seretse khama", placeId: "gaborone", zoneId: "gaborone-east", label: "Sir Seretse Khama Airport", lat: -24.5552, lng: 25.9185 },
    { q: "mogoditshane", placeId: "gaborone", zoneId: "gaborone-west", label: "Mogoditshane", lat: -24.6265, lng: 25.855 },
    { q: "block 8", placeId: "gaborone", zoneId: "gaborone-west", label: "Block 8", lat: -24.655, lng: 25.845 },
    { q: "block 6", placeId: "gaborone", zoneId: "gaborone-west", label: "Mogoditshane Block 6", lat: -24.638, lng: 25.868 },
    { q: "gaborone west", placeId: "gaborone", zoneId: "gaborone-west", label: "Gaborone West", lat: -24.648, lng: 25.86 },
    { q: "g-west", placeId: "gaborone", zoneId: "gaborone-west", label: "Gaborone West", lat: -24.648, lng: 25.86 },
    { q: "phase 4", placeId: "gaborone", zoneId: "gaborone-west", label: "Phase 4", lat: -24.645, lng: 25.872 },
    { q: "metsimotlhabe", placeId: "gaborone", zoneId: "gaborone-west", label: "Metsimotlhabe", lat: -24.63, lng: 25.8 },
    { q: "mmopane", placeId: "gaborone", zoneId: "gaborone-west", label: "Mmopane", lat: -24.565, lng: 25.815 },
    { q: "gabane", placeId: "gaborone", zoneId: "gaborone-west", label: "Gabane", lat: -24.664, lng: 25.782 },
    { q: "game city", placeId: "gaborone", zoneId: "gaborone-south", label: "Game City", lat: -24.6885, lng: 25.9065 },
    { q: "kgale", placeId: "gaborone", zoneId: "gaborone-south", label: "Kgale View", lat: -24.708, lng: 25.888 },
    { q: "kgale view", placeId: "gaborone", zoneId: "gaborone-south", label: "Kgale View", lat: -24.708, lng: 25.888 },
    { q: "old naledi", placeId: "gaborone", zoneId: "gaborone-south", label: "Old Naledi", lat: -24.68, lng: 25.922 },
    { q: "naledi", placeId: "gaborone", zoneId: "gaborone-south", label: "Old Naledi", lat: -24.68, lng: 25.922 },
    { q: "monarch", placeId: "francistown", label: "Monarch", lat: -21.19, lng: 27.49 },
    { q: "blue jacket", placeId: "francistown", label: "Blue Jacket Street", lat: -21.167, lng: 27.507 },
    { q: "nzano", placeId: "francistown", label: "Nzano Mall", lat: -21.172, lng: 27.515 },
    { q: "boseja", placeId: "maun", label: "Boseja", lat: -19.97, lng: 23.44 },
    { q: "shorobe", placeId: "maun", label: "Shorobe", lat: -19.85, lng: 23.45 }
  ],
  places: [
    {
      id: "gaborone",
      name: "Gaborone",
      kind: "city",
      lat: -24.6282,
      lng: 25.9231,
      popular: true,
      landmarks: [
        { name: "Station", lat: -24.6548, lng: 25.9078 },
        { name: "Main Mall", lat: -24.6468, lng: 25.9088 },
        { name: "Bus rank", lat: -24.6625, lng: 25.9185 },
        { name: "Riverwalk", lat: -24.6475, lng: 25.9465 },
        { name: "Game City", lat: -24.6885, lng: 25.9065 },
        { name: "Broadhurst", lat: -24.623, lng: 25.952 },
        { name: "Mogoditshane", lat: -24.6265, lng: 25.855 },
        { name: "Phakalane", lat: -24.572, lng: 25.985 },
        { name: "Block 8", lat: -24.655, lng: 25.845 },
        { name: "Sir Seretse Khama Airport", lat: -24.5552, lng: 25.9185 }
      ],
      zones: [
        { id: "gaborone-central", name: "Central / CBD", summary: "Main Mall, Station / Bus rank", lat: -24.655, lng: 25.911, sort: 1 },
        { id: "gaborone-east", name: "East / Peri-Urban", summary: "Tlokweng, Broadhurst, Riverwalk", lat: -24.65, lng: 25.96, sort: 2 },
        { id: "gaborone-west", name: "West / Satellites", summary: "Mogoditshane, Block 8 and Gabane", lat: -24.64, lng: 25.85, sort: 3 },
        { id: "gaborone-south", name: "South", summary: "Game City, Kgale, Old Naledi", lat: -24.69, lng: 25.91, sort: 4 }
      ],
      routes: [
        {
          id: "gabs-kombi-broadhurst-1",
          name: "Broadhurst Route 1",
          transport_type: "kombi",
          zone_id: "gaborone-east",
          origin_name: "Station",
          destination_name: "Broadhurst",
          summary: "From the Station past Princess Marina Hospital into Broadhurst.",
          guide: true,
          path: line([[-24.6548, 25.9078], [-24.6562, 25.9235], [-24.64, 25.938], [-24.623, 25.952]])
        },
        {
          id: "gabs-kombi-broadhurst-2",
          name: "Broadhurst Route 2",
          transport_type: "kombi",
          zone_id: "gaborone-east",
          origin_name: "Station",
          destination_name: "Broadhurst north",
          summary: "A second Broadhurst corridor from the Station toward the north of the suburb.",
          guide: true,
          path: line([[-24.6548, 25.9078], [-24.646, 25.92], [-24.628, 25.944], [-24.61, 25.965]])
        },
        {
          id: "gabs-kombi-broadhurst-5",
          name: "Broadhurst Route 5",
          transport_type: "kombi",
          zone_id: "gaborone-east",
          origin_name: "Main Mall",
          destination_name: "Broadhurst",
          summary: "Runs from the Main Mall side toward Broadhurst, with a connection near Riverwalk.",
          guide: true,
          path: line([[-24.6468, 25.9088], [-24.649, 25.928], [-24.6475, 25.9465], [-24.63, 25.958]])
        },
        {
          id: "gabs-kombi-tlokweng-4",
          name: "Tlokweng Route 4",
          transport_type: "kombi",
          zone_id: "gaborone-east",
          origin_name: "Bus rank",
          destination_name: "Tlokweng",
          summary: "From the bus rank at Rail Park out to Tlokweng.",
          guide: true,
          path: line([[-24.6625, 25.9185], [-24.655, 25.94], [-24.66, 25.96], [-24.678, 25.978]])
        },
        {
          id: "gabs-kombi-tlokweng-5",
          name: "Tlokweng Route 5",
          transport_type: "kombi",
          zone_id: "gaborone-east",
          origin_name: "Main Mall",
          destination_name: "Tlokweng",
          summary: "From the Main Mall western side toward the Tlokweng road.",
          guide: true,
          path: line([[-24.6468, 25.9088], [-24.65, 25.93], [-24.662, 25.955], [-24.678, 25.978]])
        },
        {
          id: "gabs-kombi-tlokweng-6",
          name: "Tlokweng Route 6",
          transport_type: "kombi",
          zone_id: "gaborone-east",
          origin_name: "Riverwalk",
          destination_name: "Tlokweng",
          summary: "Connects near the Riverwalk and IDM lights and continues to Tlokweng.",
          guide: true,
          path: line([[-24.6475, 25.9465], [-24.655, 25.96], [-24.678, 25.978]])
        },
        {
          id: "gabs-kombi-kgale-3",
          name: "Kgale View Route 3",
          transport_type: "kombi",
          zone_id: "gaborone-south",
          origin_name: "Bus rank",
          destination_name: "Kgale View",
          summary: "From the bus rank south toward Kgale View.",
          guide: true,
          path: line([[-24.6625, 25.9185], [-24.678, 25.91], [-24.695, 25.898], [-24.708, 25.888]])
        },
        {
          id: "gabs-kombi-game-city",
          name: "Game City",
          transport_type: "kombi",
          zone_id: "gaborone-south",
          origin_name: "Bus rank",
          destination_name: "Game City",
          summary: "South from the bus rank to Game City.",
          guide: true,
          path: line([[-24.6625, 25.9185], [-24.674, 25.912], [-24.6885, 25.9065]])
        },
        {
          id: "gabs-kombi-mogoditshane-8",
          name: "Mogoditshane Route 8",
          transport_type: "kombi",
          zone_id: "gaborone-west",
          origin_name: "Bus rank",
          destination_name: "Mogoditshane Block 6",
          summary: "The Block 6 corridor between the bus rank and Mogoditshane.",
          guide: true,
          path: line([[-24.6625, 25.9185], [-24.65, 25.89], [-24.638, 25.868], [-24.6265, 25.855]])
        },
        {
          id: "gabs-kombi-mogoditshane-7",
          name: "Mogoditshane Route 7",
          transport_type: "kombi",
          zone_id: "gaborone-west",
          origin_name: "Mogoditshane",
          destination_name: "Phase 4",
          summary: "Serves Mogoditshane and Phase 4.",
          guide: true,
          path: line([[-24.6265, 25.855], [-24.634, 25.862], [-24.645, 25.872]])
        },
        {
          id: "gabs-kombi-gwest",
          name: "Gaborone West / Block 8",
          transport_type: "kombi",
          zone_id: "gaborone-west",
          origin_name: "Station",
          destination_name: "Block 8",
          summary: "From the Station through Gaborone West toward Block 8.",
          guide: true,
          path: line([[-24.6548, 25.9078], [-24.652, 25.885], [-24.648, 25.86], [-24.655, 25.845]])
        },
        {
          id: "gabs-kombi-old-naledi",
          name: "Old Naledi",
          transport_type: "kombi",
          zone_id: "gaborone-south",
          origin_name: "Station",
          destination_name: "Old Naledi",
          summary: "A short southern corridor from the Station to Old Naledi.",
          guide: true,
          path: line([[-24.6548, 25.9078], [-24.666, 25.914], [-24.68, 25.922]])
        },
        {
          id: "gabs-kombi-bontleng",
          name: "Bontleng & White City",
          transport_type: "kombi",
          zone_id: "gaborone-central",
          origin_name: "Station",
          destination_name: "Bontleng",
          summary: "Covers Bontleng and White City beside the Station.",
          guide: true,
          path: line([[-24.6548, 25.9078], [-24.662, 25.914], [-24.667, 25.917]])
        },
        {
          id: "gabs-kombi-phakalane",
          name: "Phakalane & Gaborone North",
          transport_type: "kombi",
          zone_id: "gaborone-east",
          origin_name: "Station",
          destination_name: "Phakalane",
          summary: "North from the Station through Gaborone North to Phakalane.",
          guide: true,
          path: line([[-24.6548, 25.9078], [-24.63, 25.925], [-24.605, 25.94], [-24.572, 25.985]])
        },
        {
          id: "gabs-kombi-village",
          name: "Village & Extension 9",
          transport_type: "kombi",
          zone_id: "gaborone-central",
          origin_name: "Main Mall",
          destination_name: "The Village",
          summary: "From Main Mall toward The Village and Extension 9.",
          guide: true,
          path: line([[-24.6468, 25.9088], [-24.656, 25.909], [-24.668, 25.91]])
        },
        {
          id: "gabs-kombi-ledumang",
          name: "Ledumang & Extension 14",
          transport_type: "kombi",
          zone_id: "gaborone-central",
          origin_name: "Station",
          destination_name: "Ledumang",
          summary: "West of the Station into Ledumang and Extension 14.",
          guide: true,
          path: line([[-24.6548, 25.9078], [-24.648, 25.896], [-24.643, 25.888], [-24.64, 25.882]])
        },
        {
          id: "gabs-kombi-metsimotlhabe",
          name: "Metsimotlhabe",
          transport_type: "kombi",
          zone_id: "gaborone-west",
          origin_name: "Gaborone West",
          destination_name: "Metsimotlhabe",
          summary: "Continues past Gaborone West to Metsimotlhabe.",
          guide: true,
          path: line([[-24.648, 25.86], [-24.64, 25.83], [-24.63, 25.8]])
        },
        {
          id: "gabs-kombi-mmopane-gabane",
          name: "Mmopane & Gabane",
          transport_type: "kombi",
          zone_id: "gaborone-west",
          origin_name: "Mogoditshane",
          destination_name: "Gabane",
          summary: "From Mogoditshane toward Mmopane and Gabane.",
          guide: true,
          path: line([[-24.6265, 25.855], [-24.64, 25.82], [-24.664, 25.782]])
        },
        {
          id: "gabs-kombi-oodi",
          name: "Oodi & Modipane",
          transport_type: "kombi",
          zone_id: "gaborone-east",
          origin_name: "Gaborone North",
          destination_name: "Oodi",
          summary: "North-east out of Gaborone toward Oodi and Modipane.",
          guide: true,
          path: line([[-24.605, 25.94], [-24.585, 25.98], [-24.568, 26.035]])
        },
        {
          id: "gabs-taxi-station",
          name: "Station taxi rank",
          transport_type: "taxi",
          zone_id: "gaborone-central",
          origin_name: "Station",
          destination_name: "City trips",
          summary: "Local cabs waiting at the Station.",
          guide: true,
          path: around(-24.6548, 25.9078)
        },
        {
          id: "gabs-taxi-bus-rank",
          name: "Bus rank & Rail Park taxis",
          transport_type: "taxi",
          zone_id: "gaborone-central",
          origin_name: "Bus rank",
          destination_name: "City trips",
          summary: "Taxis at the bus rank behind Rail Park.",
          guide: true,
          path: around(-24.6625, 25.9185)
        },
        {
          id: "gabs-taxi-main-mall",
          name: "Main Mall taxis",
          transport_type: "taxi",
          zone_id: "gaborone-central",
          origin_name: "Main Mall",
          destination_name: "City trips",
          summary: "Cabs along Main Mall.",
          guide: true,
          path: around(-24.6468, 25.9088)
        },
        {
          id: "gabs-taxi-game-city",
          name: "Game City taxi rank",
          transport_type: "taxi",
          zone_id: "gaborone-south",
          origin_name: "Game City",
          destination_name: "South trips",
          summary: "Taxis waiting at Game City.",
          guide: true,
          path: around(-24.6885, 25.9065)
        },
        {
          id: "gabs-taxi-riverwalk",
          name: "Riverwalk taxi rank",
          transport_type: "taxi",
          zone_id: "gaborone-east",
          origin_name: "Riverwalk",
          destination_name: "East trips",
          summary: "Taxis at Riverwalk Mall.",
          guide: true,
          path: around(-24.6475, 25.9465)
        },
        {
          id: "gabs-taxi-broadhurst",
          name: "Broadhurst taxis",
          transport_type: "taxi",
          zone_id: "gaborone-east",
          origin_name: "Broadhurst",
          destination_name: "East trips",
          summary: "Local cabs in Broadhurst.",
          guide: true,
          path: around(-24.623, 25.952)
        },
        {
          id: "gabs-taxi-mogoditshane",
          name: "Mogoditshane taxis",
          transport_type: "taxi",
          zone_id: "gaborone-west",
          origin_name: "Mogoditshane",
          destination_name: "West trips",
          summary: "Taxis around Mogoditshane.",
          guide: true,
          path: around(-24.6265, 25.855)
        },
        {
          id: "gabs-taxi-block-8",
          name: "Block 8 taxis",
          transport_type: "taxi",
          zone_id: "gaborone-west",
          origin_name: "Block 8",
          destination_name: "West trips",
          summary: "Taxis in Gaborone West and Block 8.",
          guide: true,
          path: around(-24.655, 25.845)
        },
        {
          id: "gabs-taxi-phakalane",
          name: "Phakalane taxis",
          transport_type: "taxi",
          zone_id: "gaborone-east",
          origin_name: "Phakalane",
          destination_name: "North trips",
          summary: "Taxis around Phakalane and Gaborone North.",
          guide: true,
          path: around(-24.572, 25.985)
        },
        {
          id: "gabs-taxi-airport",
          name: "Airport taxis",
          transport_type: "taxi",
          zone_id: "gaborone-east",
          origin_name: "Sir Seretse Khama Airport",
          destination_name: "Airport trips",
          summary: "Cabs at Sir Seretse Khama International Airport.",
          guide: true,
          path: around(-24.5552, 25.9185)
        },
        coach("gabs-bus-lobatse", "Gaborone to Lobatse", "Bus rank", "Lobatse", line([[-24.6625, 25.9185], [-24.95, 25.78], [-25.2244, 25.6773]]), "Coaches from the Gaborone bus rank to Lobatse. They leave when ready, not on a published clock."),
        coach("gabs-bus-kanye", "Gaborone to Kanye", "Bus rank", "Kanye", line([[-24.6625, 25.9185], [-24.8, 25.6], [-24.9667, 25.3327]]), "Coaches from the bus rank toward Kanye."),
        coach("gabs-bus-jwaneng", "Gaborone to Jwaneng", "Bus rank", "Jwaneng", line([[-24.6625, 25.9185], [-24.75, 25.2], [-24.6017, 24.7281]]), "Coaches from the bus rank toward Jwaneng."),
        coach("gabs-bus-molepolole", "Gaborone to Molepolole", "Bus rank", "Molepolole", line([[-24.6625, 25.9185], [-24.55, 25.7], [-24.4066, 25.4951]]), "Coaches from the bus rank toward Molepolole."),
        coach("gabs-bus-mochudi", "Gaborone to Mochudi", "Bus rank", "Mochudi", line([[-24.6625, 25.9185], [-24.5, 26.05], [-24.377, 26.152]]), "Coaches and combis toward Mochudi."),
        coach("gabs-bus-mahalapye", "Gaborone to Mahalapye", "Bus rank", "Mahalapye", line([[-24.6625, 25.9185], [-23.9, 26.3], [-23.1041, 26.8142]]), "Northbound coaches along the A1 to Mahalapye."),
        coach("gabs-bus-palapye", "Gaborone to Palapye", "Bus rank", "Palapye", line([[-24.6625, 25.9185], [-23.1041, 26.8142], [-22.546, 27.1251]]), "A1 coaches from the bus rank to Palapye."),
        coach("gabs-bus-serowe", "Gaborone to Serowe", "Bus rank", "Serowe", line([[-24.6625, 25.9185], [-23.1041, 26.8142], [-22.3875, 26.7108]]), "Coaches from the bus rank toward Serowe."),
        coach("gabs-bus-selibe", "Gaborone to Selebi-Phikwe", "Bus rank", "Selebi-Phikwe", line([[-24.6625, 25.9185], [-22.546, 27.1251], [-21.979, 27.843]]), "Coaches from the bus rank to Selebi-Phikwe."),
        coach("gabs-bus-francistown", "Gaborone to Francistown", "Bus rank", "Francistown", line([[-24.6625, 25.9185], [-23.1041, 26.8142], [-22.546, 27.1251], [-21.1702, 27.5078]]), "A1 coaches from the Gaborone bus rank to Francistown."),
        coach("gabs-bus-maun", "Gaborone to Maun", "Bus rank", "Maun", line([[-24.6625, 25.9185], [-22.546, 27.1251], [-21.1702, 27.5078], [-20.2167, 26.1833], [-19.9833, 23.4167]]), "Long-distance coaches toward Maun. They wait at the bus rank."),
        coach("gabs-bus-ghanzi", "Gaborone to Ghanzi", "Bus rank", "Ghanzi", line([[-24.6625, 25.9185], [-24.2, 23.5], [-21.697, 21.645]]), "Coaches from the bus rank toward Ghanzi."),
        coach("gabs-bus-kasane", "Gaborone to Kasane", "Bus rank", "Kasane", line([[-24.6625, 25.9185], [-21.1702, 27.5078], [-20.2167, 26.1833], [-17.7983, 25.1536]]), "Coaches from the bus rank toward Kasane via the north."),
        Object.assign(taxi("gabs-taxi-cbd-extra", "Airport Junction taxis", -24.612, 25.92, "Taxis around Airport Junction."), { id: "gabs-taxi-airport-junction", zone_id: "gaborone-east", origin_name: "Airport Junction" })
      ]
    },
    {
      id: "francistown",
      name: "Francistown",
      kind: "city",
      lat: -21.1702,
      lng: 27.5078,
      popular: true,
      landmarks: [
        { name: "Bus rank", lat: -21.17, lng: 27.508 },
        { name: "Blue Jacket Street", lat: -21.167, lng: 27.507 },
        { name: "Monarch", lat: -21.19, lng: 27.49 },
        { name: "Nzano Mall", lat: -21.172, lng: 27.515 }
      ],
      zones: [
        { id: "francistown-central", name: "Central", summary: "Bus rank, Blue Jacket and Nzano", lat: -21.17, lng: 27.51, sort: 1 },
        { id: "francistown-west", name: "Monarch & west", summary: "Monarch and the western suburbs", lat: -21.188, lng: 27.49, sort: 2 },
        { id: "francistown-east", name: "Satellite & east", summary: "Satellite and Somerset", lat: -21.168, lng: 27.53, sort: 3 }
      ],
      routes: [
        { id: "town-kombi-monarch", name: "Monarch", transport_type: "kombi", zone_id: "francistown-west", origin_name: "Bus rank", destination_name: "Monarch", summary: "Local kombis from the Francistown rank toward Monarch.", guide: true, path: line([[-21.17, 27.508], [-21.18, 27.498], [-21.19, 27.49]]) },
        { id: "town-kombi-somerset", name: "Somerset", transport_type: "kombi", zone_id: "francistown-east", origin_name: "Bus rank", destination_name: "Somerset", summary: "Local kombis toward Somerset.", guide: true, path: line([[-21.17, 27.508], [-21.16, 27.5], [-21.155, 27.49]]) },
        { id: "town-kombi-satellite", name: "Satellite", transport_type: "kombi", zone_id: "francistown-east", origin_name: "Bus rank", destination_name: "Satellite", summary: "Local kombis toward Satellite.", guide: true, path: line([[-21.17, 27.508], [-21.176, 27.52], [-21.18, 27.53]]) },
        { id: "town-kombi-blue-town", name: "Area W & Blue Town", transport_type: "kombi", zone_id: "francistown-central", origin_name: "Bus rank", destination_name: "Blue Town", summary: "Short central corridors around Area W and Blue Town.", guide: true, path: line([[-21.17, 27.508], [-21.174, 27.512], [-21.178, 27.506]]) },
        { id: "town-kombi-tati", name: "Tati Town & Aerodrome", transport_type: "kombi", zone_id: "francistown-central", origin_name: "Bus rank", destination_name: "Tati Town", summary: "Toward Tati Town and the aerodrome side.", guide: true, path: line([[-21.17, 27.508], [-21.155, 27.5], [-21.14, 27.52]]) },
        taxi("town-taxi-rank", "Francistown bus rank taxis", -21.17, 27.508, "Taxis at the Francistown bus rank."),
        taxi("town-taxi-blue-jacket", "Blue Jacket Street taxis", -21.167, 27.507, "Taxis along Blue Jacket Street."),
        taxi("town-taxi-nzano", "Nzano Mall taxis", -21.172, 27.515, "Taxis at Nzano Mall."),
        coach("town-bus-gabs", "Francistown to Gaborone", "Bus rank", "Gaborone", line([[-21.17, 27.508], [-22.546, 27.125], [-23.104, 26.814], [-24.6625, 25.9185]]), "Southbound A1 coaches to Gaborone."),
        coach("town-bus-maun", "Francistown to Maun", "Bus rank", "Maun", line([[-21.17, 27.508], [-20.2167, 26.1833], [-19.9833, 23.4167]]), "Coaches toward Maun via Nata."),
        coach("town-bus-kasane", "Francistown to Kasane", "Bus rank", "Kasane", line([[-21.17, 27.508], [-20.2167, 26.1833], [-17.7983, 25.1536]]), "Coaches toward Kasane via Nata.")
      ]
    },
    {
      id: "maun",
      name: "Maun",
      kind: "town",
      lat: -19.9833,
      lng: 23.4167,
      popular: true,
      landmarks: [
        { name: "Bus rank", lat: -19.984, lng: 23.418 },
        { name: "Airport", lat: -19.9726, lng: 23.4311 },
        { name: "Boseja", lat: -19.97, lng: 23.44 }
      ],
      zones: [],
      routes: [
        { id: "maun-kombi-boseja", name: "Boseja", transport_type: "kombi", zone_id: null, origin_name: "Bus rank", destination_name: "Boseja", summary: "Local kombis toward Boseja.", guide: true, path: line([[-19.984, 23.418], [-19.976, 23.428], [-19.97, 23.44]]) },
        { id: "maun-kombi-disaneng", name: "Disaneng", transport_type: "kombi", zone_id: null, origin_name: "Bus rank", destination_name: "Disaneng", summary: "Local kombis toward Disaneng.", guide: true, path: line([[-19.984, 23.418], [-19.992, 23.408], [-20.0, 23.4]]) },
        { id: "maun-kombi-sedie", name: "Sedie & Boyei", transport_type: "kombi", zone_id: null, origin_name: "Bus rank", destination_name: "Sedie", summary: "Local kombis toward Sedie and Boyei.", guide: true, path: line([[-19.984, 23.418], [-19.988, 23.435], [-19.99, 23.45]]) },
        { id: "maun-kombi-shorobe", name: "Shorobe", transport_type: "kombi", zone_id: null, origin_name: "Bus rank", destination_name: "Shorobe", summary: "The road north from Maun toward Shorobe.", guide: true, path: line([[-19.984, 23.418], [-19.92, 23.43], [-19.85, 23.45]]) },
        { id: "maun-kombi-matlapana", name: "Matlapana", transport_type: "kombi", zone_id: null, origin_name: "Bus rank", destination_name: "Matlapana", summary: "Local kombis toward Matlapana.", guide: true, path: line([[-19.984, 23.418], [-19.972, 23.445], [-19.96, 23.47]]) },
        taxi("maun-taxi-rank", "Maun bus rank taxis", -19.984, 23.418, "Taxis at the Maun bus rank."),
        taxi("maun-taxi-airport", "Maun airport taxis", -19.9726, 23.4311, "Taxis at Maun airport."),
        taxi("maun-taxi-boseja", "Boseja taxis", -19.97, 23.44, "Taxis around Boseja."),
        coach("maun-bus-town", "Maun to Francistown", "Bus rank", "Francistown", line([[-19.984, 23.418], [-20.2167, 26.1833], [-21.17, 27.508]]), "Coaches from Maun toward Francistown via Nata."),
        coach("maun-bus-kasane", "Maun to Kasane", "Bus rank", "Kasane", line([[-19.984, 23.418], [-19.2, 23.9], [-17.7983, 25.1536]]), "Coaches from Maun toward Kasane.")
      ]
    },
    {
      id: "lobatse",
      name: "Lobatse",
      kind: "town",
      lat: -25.2244,
      lng: 25.6773,
      popular: true,
      landmarks: [{ name: "Bus rank", lat: -25.2244, lng: 25.6773 }],
      zones: [],
      routes: [
        { id: "lobatse-kombi-woodhall", name: "Woodhall", transport_type: "kombi", zone_id: null, origin_name: "Lobatse rank", destination_name: "Woodhall", summary: "Local kombis toward Woodhall.", guide: true, path: line([[-25.2244, 25.6773], [-25.228, 25.684], [-25.23, 25.69]]) },
        { id: "lobatse-kombi-peleng", name: "Peleng", transport_type: "kombi", zone_id: null, origin_name: "Lobatse rank", destination_name: "Peleng", summary: "Local kombis toward Peleng.", guide: true, path: line([[-25.2244, 25.6773], [-25.232, 25.67], [-25.24, 25.665]]) },
        taxi("lobatse-taxi-rank", "Lobatse taxi rank", -25.2244, 25.6773, "Taxis at the Lobatse rank."),
        coach("lobatse-bus-gabs", "Lobatse to Gaborone", "Lobatse rank", "Gaborone", line([[-25.2244, 25.6773], [-24.95, 25.78], [-24.6625, 25.9185]]), "Coaches from Lobatse to the Gaborone bus rank.")
      ]
    },
    {
      id: "palapye",
      name: "Palapye",
      kind: "town",
      lat: -22.546,
      lng: 27.1251,
      popular: true,
      landmarks: [{ name: "Bus rank", lat: -22.546, lng: 27.125 }],
      zones: [],
      routes: [
        { id: "palapye-kombi-lotsane", name: "Lotsane", transport_type: "kombi", zone_id: null, origin_name: "Palapye rank", destination_name: "Lotsane", summary: "Local kombis toward Lotsane.", guide: true, path: line([[-22.546, 27.125], [-22.55, 27.132], [-22.555, 27.14]]) },
        { id: "palapye-kombi-serorome", name: "Serorome", transport_type: "kombi", zone_id: null, origin_name: "Palapye rank", destination_name: "Serorome", summary: "Local kombis toward Serorome.", guide: true, path: line([[-22.546, 27.125], [-22.542, 27.118], [-22.54, 27.11]]) },
        taxi("palapye-taxi-rank", "Palapye taxi rank", -22.546, 27.125, "Taxis at the Palapye rank."),
        coach("palapye-bus-serowe", "Palapye to Serowe", "Palapye rank", "Serowe", line([[-22.546, 27.125], [-22.46, 26.9], [-22.3875, 26.7108]]), "Coaches from Palapye to Serowe."),
        coach("palapye-bus-mahalapye", "Palapye to Mahalapye", "Palapye rank", "Mahalapye", line([[-22.546, 27.125], [-22.8, 26.95], [-23.1041, 26.8142]]), "A1 coaches between Palapye and Mahalapye."),
        coach("palapye-bus-town", "Palapye to Francistown", "Palapye rank", "Francistown", line([[-22.546, 27.125], [-21.8, 27.3], [-21.17, 27.508]]), "A1 coaches from Palapye to Francistown.")
      ]
    },
    {
      id: "kasane",
      name: "Kasane",
      kind: "town",
      lat: -17.7983,
      lng: 25.1536,
      popular: true,
      landmarks: [
        { name: "Kasane centre", lat: -17.7983, lng: 25.1536 },
        { name: "Kazungula", lat: -17.7928, lng: 25.2678 }
      ],
      zones: [],
      routes: [
        { id: "kasane-kombi-plateau", name: "Plateau", transport_type: "kombi", zone_id: null, origin_name: "Kasane", destination_name: "Plateau", summary: "Local trips toward Plateau.", guide: true, path: line([[-17.7983, 25.1536], [-17.804, 25.15], [-17.81, 25.155]]) },
        { id: "kasane-kombi-kazungula", name: "Kazungula", transport_type: "kombi", zone_id: null, origin_name: "Kasane", destination_name: "Kazungula", summary: "The corridor between Kasane and Kazungula.", guide: true, path: line([[-17.7983, 25.1536], [-17.795, 25.21], [-17.7928, 25.2678]]) },
        taxi("kasane-taxi-rank", "Kasane taxis", -17.7983, 25.1536, "Taxis in Kasane centre."),
        coach("kasane-bus-nata", "Kasane to Nata", "Kasane", "Nata", line([[-17.7983, 25.1536], [-19.0, 25.7], [-20.2167, 26.1833]]), "Southbound coaches from Kasane toward Nata.")
      ]
    },
    placeHub("mahalapye", "Mahalapye", "town", -23.1041, 26.8142, false, [
      coach("mahalapye-bus-gabs", "Mahalapye to Gaborone", "Mahalapye rank", "Gaborone", line([[-23.1041, 26.8142], [-23.9, 26.3], [-24.6625, 25.9185]]), "A1 coaches south to Gaborone."),
      coach("mahalapye-bus-town", "Mahalapye to Francistown", "Mahalapye rank", "Francistown", line([[-23.1041, 26.8142], [-22.546, 27.125], [-21.17, 27.508]]), "A1 coaches north to Francistown.")
    ]),
    placeHub("serowe", "Serowe", "town", -22.3875, 26.7108, false, [
      coach("serowe-bus-palapye", "Serowe to Palapye", "Serowe rank", "Palapye", line([[-22.3875, 26.7108], [-22.46, 26.9], [-22.546, 27.125]]), "Coaches from Serowe to Palapye.")
    ]),
    placeHub("selebi-phikwe", "Selebi-Phikwe", "town", -21.979, 27.843, false, [
      coach("selibe-bus-palapye", "Selebi-Phikwe to Palapye", "Bus rank", "Palapye", line([[-21.979, 27.843], [-22.2, 27.5], [-22.546, 27.125]]), "Coaches from Selebi-Phikwe toward Palapye.")
    ]),
    placeHub("kanye", "Kanye", "town", -24.9667, 25.3327, false, [
      coach("kanye-bus-gabs", "Kanye to Gaborone", "Kanye rank", "Gaborone", line([[-24.9667, 25.3327], [-24.8, 25.6], [-24.6625, 25.9185]]), "Coaches from Kanye to Gaborone.")
    ]),
    placeHub("molepolole", "Molepolole", "town", -24.4066, 25.4951, false, [
      coach("molepolole-bus-gabs", "Molepolole to Gaborone", "Molepolole rank", "Gaborone", line([[-24.4066, 25.4951], [-24.55, 25.7], [-24.6625, 25.9185]]), "Coaches from Molepolole to Gaborone.")
    ]),
    placeHub("jwaneng", "Jwaneng", "town", -24.6017, 24.7281, false, [
      coach("jwaneng-bus-gabs", "Jwaneng to Gaborone", "Jwaneng rank", "Gaborone", line([[-24.6017, 24.7281], [-24.7, 25.2], [-24.6625, 25.9185]]), "Coaches from Jwaneng toward Gaborone.")
    ]),
    placeHub("mochudi", "Mochudi", "village", -24.377, 26.152, false, [
      coach("mochudi-bus-gabs", "Mochudi to Gaborone", "Mochudi rank", "Gaborone", line([[-24.377, 26.152], [-24.5, 26.05], [-24.6625, 25.9185]]), "Combis and coaches from Mochudi to Gaborone.")
    ]),
    placeHub("ghanzi", "Ghanzi", "town", -21.697, 21.645, false, [
      coach("ghanzi-bus-gabs", "Ghanzi to Gaborone", "Ghanzi rank", "Gaborone", line([[-21.697, 21.645], [-23.2, 23.4], [-24.6625, 25.9185]]), "Long-distance coaches from Ghanzi toward Gaborone.")
    ]),
    placeHub("nata", "Nata", "village", -20.2167, 26.1833, false, [
      coach("nata-bus-town", "Nata to Francistown", "Nata", "Francistown", line([[-20.2167, 26.1833], [-20.7, 26.8], [-21.17, 27.508]]), "Coaches through Nata toward Francistown."),
      coach("nata-bus-kasane", "Nata to Kasane", "Nata", "Kasane", line([[-20.2167, 26.1833], [-19.0, 25.7], [-17.7983, 25.1536]]), "Northbound coaches from Nata to Kasane.")
    ]),
    placeHub("ramotswa", "Ramotswa", "village", -24.8728, 25.8697, false, [
      coach("ramotswa-bus-gabs", "Ramotswa to Gaborone", "Ramotswa", "Gaborone", line([[-24.8728, 25.8697], [-24.76, 25.89], [-24.6625, 25.9185]]), "The short corridor from Ramotswa into Gaborone.")
    ]),
    placeHub("thamaga", "Thamaga", "village", -24.6703, 25.5394, false, []),
    placeHub("moshupa", "Moshupa", "village", -24.7714, 25.4203, false, []),
    placeHub("goodhope", "Good Hope", "village", -25.4781, 25.4358, false, []),
    placeHub("letlhakane", "Letlhakane", "town", -21.4167, 25.5928, false, []),
    placeHub("orapa", "Orapa", "town", -21.3115, 25.3764, false, []),
    placeHub("sowa", "Sowa", "town", -20.5636, 26.2244, false, []),
    placeHub("tsabong", "Tsabong", "town", -26.0217, 22.4056, false, []),
    placeHub("shakawe", "Shakawe", "village", -18.3658, 21.8422, false, []),
    placeHub("tutume", "Tutume", "village", -20.4917, 27.0281, false, []),
    placeHub("tonota", "Tonota", "village", -21.4425, 27.4614, false, []),
    placeHub("bobonong", "Bobonong", "village", -21.9686, 28.4211, false, []),
    placeHub("mmadinare", "Mmadinare", "village", -21.8811, 27.7514, false, []),
    placeHub("gumare", "Gumare", "village", -19.3667, 22.1667, false, []),
    placeHub("hukuntsi", "Hukuntsi", "village", -23.9983, 21.7794, false, []),
    placeHub("kang", "Kang", "village", -23.68, 22.7875, false, []),
    placeHub("kazungula", "Kazungula", "village", -17.7928, 25.2678, false, [])
  ]
};

function placeHub(id, name, kind, lat, lng, popular, extraRoutes) {
  return {
    id,
    name,
    kind,
    lat,
    lng,
    popular,
    landmarks: [{ name: `${name} rank`, lat, lng }],
    zones: [],
    routes: [
      taxi(`${id}-taxi-rank`, `${name} taxi rank`, lat, lng, `Local taxis around the ${name} rank.`),
      ...extraRoutes
    ]
  };
}

export function localCatalog() {
  return structuredClone(catalog);
}
