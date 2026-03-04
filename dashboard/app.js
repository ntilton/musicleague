const DATA_URL = "../data/processed/submissions_enriched.csv";

const seasonFilter = document.getElementById("seasonFilter");
const roundFilter = document.getElementById("roundFilter");
const resetFiltersButton = document.getElementById("resetFilters");
const kpiSubmissions = document.getElementById("kpiSubmissions");
const kpiTracks = document.getElementById("kpiTracks");
const kpiCompetitors = document.getElementById("kpiCompetitors");
const seasonWinsRollupBody = document.querySelector("#seasonWinsRollupTable tbody");
const seasonWinnersBody = document.querySelector("#seasonWinnersTable tbody");
const seasonsLeaderboardBody = document.querySelector("#seasonsLeaderboardTable tbody");
const businessCasualLeaderboardBody = document.querySelector("#businessCasualLeaderboardTable tbody");
const duplicateTracksBody = document.querySelector("#duplicateTracksTable tbody");
const songSearchInput = document.getElementById("songSearchInput");
const songSearchCount = document.getElementById("songSearchCount");
const songSearchBody = document.querySelector("#songSearchTable tbody");
const songRowsPerPage = document.getElementById("songRowsPerPage");
const songPrevPage = document.getElementById("songPrevPage");
const songNextPage = document.getElementById("songNextPage");
const songPageInfo = document.getElementById("songPageInfo");

let topSongsChart;
let topSubmittersChart;
let topArtistsChart;
let rows = [];
const expandedSeasons = new Set();
const expandedRounds = new Set();
let songSearchPage = 1;

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value) {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return null;
  }
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function formatDate(value) {
  if (!(value instanceof Date)) {
    return "";
  }
  return value.toISOString().slice(0, 7).replace("-", "/");
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeSourceZip(value) {
  const raw = cleanText(value);
  if (!raw) {
    return "Unknown";
  }

  const lower = raw.toLowerCase();
  const compactMatch = lower.match(/^([a-z_]+?)(\d+)$/);

  if (!compactMatch) {
    return raw
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  const prefix = compactMatch[1]
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const number = compactMatch[2].padStart(2, "0");
  return `${prefix} ${number}`;
}

function inferSourceZip(row) {
  const explicitSourceZip = cleanText(row["source_zip"]);
  if (explicitSourceZip) {
    return explicitSourceZip;
  }

  const sourcePath = cleanText(row["source_path"]);
  const match = sourcePath.match(/([^/]+)__[^/]+$/);
  if (match && match[1]) {
    return match[1];
  }

  return "";
}

function getRoundDisplay(row) {
  return cleanText(row.roundName) || cleanText(row.roundId) || "Unknown Round";
}

function mapDataRow(row) {
  const createdAt = parseDate(row["Created"]);
  const sourceZip = inferSourceZip(row);

  return {
    createdAt,
    createdRaw: cleanText(row["Created"]),
    createdLabel: formatDate(createdAt),
    roundName: cleanText(row["Round Name"]),
    roundId: cleanText(row["Round ID"]),
    sourceZip,
    seasonLabel: normalizeSourceZip(sourceZip),
    trackUri: cleanText(row["Spotify URI"]),
    title: cleanText(row["Title"]),
    album: cleanText(row["Album"]),
    artist: cleanText(row["Artist(s)"]),
    competitor: cleanText(row["Name_competitor"]),
    comment: cleanText(row["Comment"]),
    visibleToVoters: cleanText(row["Visible To Voters"]),
    points: parseNumber(row["Total Points Assigned"]),
  };
}

function initializeData(mappedRows) {
  rows = mappedRows;
  buildSeasonFilter();
  buildRoundFilter();
  render();
}

function loadData() {
  if (Array.isArray(window.__SUBMISSIONS_DATA__)) {
    initializeData(window.__SUBMISSIONS_DATA__.map(mapDataRow));
    return;
  }

  if (typeof Papa === "undefined") {
    alert("Failed to load data: PapaParse is not available and no embedded data was found.");
    return;
  }

  Papa.parse(DATA_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => {
      initializeData(data.map(mapDataRow));
    },
    error: (error) => {
      alert(`Failed to load CSV: ${error.message}`);
    },
  });
}

function buildSeasonFilter() {
  const seasons = [...new Set(rows.map((row) => row.seasonLabel).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
  );

  seasonFilter.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All Seasons";
  seasonFilter.appendChild(allOption);

  seasons.forEach((season) => {
    const option = document.createElement("option");
    option.value = season;
    option.textContent = season;
    seasonFilter.appendChild(option);
  });
}

function buildRoundFilter() {
  const selectedSeason = seasonFilter.value;
  const previousRound = roundFilter.value;

  const roundNames = [
    ...new Set(
      rows
        .filter((row) => !selectedSeason || row.seasonLabel === selectedSeason)
        .map((row) => getRoundDisplay(row))
        .filter(Boolean)
    ),
  ].sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));

  roundFilter.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All Rounds";
  roundFilter.appendChild(allOption);

  roundNames.forEach((roundName) => {
    const option = document.createElement("option");
    option.value = roundName;
    option.textContent = roundName;
    roundFilter.appendChild(option);
  });

  if (previousRound && roundNames.includes(previousRound)) {
    roundFilter.value = previousRound;
  } else {
    roundFilter.value = "";
  }
}

function getFilteredRows() {
  const selectedSeason = seasonFilter.value;
  const selectedRound = roundFilter.value;

  let filtered = rows;
  if (selectedSeason) {
    filtered = filtered.filter((row) => row.seasonLabel === selectedSeason);
  }

  if (selectedRound) {
    filtered = filtered.filter((row) => getRoundDisplay(row) === selectedRound);
  }

  return filtered;
}

function aggregateTopSongs(filteredRows, limit = 15) {
  const songTotals = new Map();

  filteredRows.forEach((row) => {
    if (!row.trackUri) {
      return;
    }
    const key = row.trackUri;
    const title = row.title || "Unknown Title";
    const artist = row.artist || "Unknown Artist";
    const submitter = row.competitor || "Unknown";

    const current = songTotals.get(key) || {
      title,
      artist,
      points: 0,
      submitters: new Set(),
    };

    current.points += row.points;
    current.submitters.add(submitter);
    songTotals.set(key, current);
  });

  return [...songTotals.values()]
    .map((entry) => ({
      title: entry.title,
      artist: entry.artist,
      points: entry.points,
      submitters: [...entry.submitters].sort(),
    }))
    .sort((left, right) => right.points - left.points)
    .slice(0, limit);
}

function aggregateTopSubmitters(filteredRows, limit = 15) {
  const submitterTotals = new Map();

  filteredRows.forEach((row) => {
    const key = row.competitor || "Unknown";
    submitterTotals.set(key, (submitterTotals.get(key) || 0) + row.points);
  });

  return [...submitterTotals.entries()]
    .map(([name, points]) => ({ name, points }))
    .sort((left, right) => right.points - left.points)
    .slice(0, limit);
}

function aggregateTopArtists(filteredRows, limit = 10) {
  const artistCounts = new Map();

  filteredRows.forEach((row) => {
    const artist = row.artist || "Unknown Artist";
    artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
  });

  return [...artistCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, limit);
}

function aggregateSeasonWinners(allRows) {
  const seasonSubmitterTotals = new Map();

  allRows.forEach((row) => {
    const season = row.seasonLabel || "Unknown";
    const submitter = row.competitor || "Unknown";

    const perSeason = seasonSubmitterTotals.get(season) || new Map();
    perSeason.set(submitter, (perSeason.get(submitter) || 0) + row.points);
    seasonSubmitterTotals.set(season, perSeason);
  });

  return [...seasonSubmitterTotals.entries()]
    .map(([season, totals]) => {
      const ranked = [...totals.entries()]
        .map(([submitter, points]) => ({ submitter, points }))
        .sort((left, right) => {
          if (right.points !== left.points) {
            return right.points - left.points;
          }
          return left.submitter.localeCompare(right.submitter, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });

      const rankGroups = [];
      ranked.forEach((entry) => {
        const existing = rankGroups.find((group) => group.points === entry.points);
        if (existing) {
          existing.submitters.push(entry.submitter);
          return;
        }
        rankGroups.push({ points: entry.points, submitters: [entry.submitter] });
      });

      const firstPlace = rankGroups[0]?.submitters ?? [];
      const secondPlace = rankGroups[1]?.submitters ?? [];
      const thirdPlace = rankGroups[2]?.submitters ?? [];
      const winningPoints = rankGroups[0]?.points ?? 0;

      return {
        season,
        winners: firstPlace,
        firstPlace,
        secondPlace,
        thirdPlace,
        points: winningPoints,
      };
    })
    .sort((left, right) => left.season.localeCompare(right.season, undefined, {
      numeric: true,
      sensitivity: "base",
    }));
}

function aggregateSeasonWinsRollup(seasonWinners) {
  const winsByCompetitor = new Map();

  seasonWinners.forEach((entry) => {
    entry.winners.forEach((winner) => {
      winsByCompetitor.set(winner, (winsByCompetitor.get(winner) || 0) + 1);
    });
  });

  return [...winsByCompetitor.entries()]
    .map(([competitor, seasonsWon]) => ({ competitor, seasonsWon }))
    .sort((left, right) => {
      if (right.seasonsWon !== left.seasonsWon) {
        return right.seasonsWon - left.seasonsWon;
      }
      return left.competitor.localeCompare(right.competitor, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

function aggregateLeaderboard(filteredRows, limit = 50) {
  const seasonMap = new Map();

  filteredRows.forEach((row) => {
    const season = normalizeSourceZip(row.sourceZip);
    const round = getRoundDisplay(row);
    const trackKey = row.trackUri || `${row.title}||${row.artist}||${row.competitor}`;

    const seasonEntry = seasonMap.get(season) || {
      season,
      points: 0,
      createdAt: null,
      rounds: new Map(),
    };
    seasonEntry.points += row.points;
    if (row.createdAt && (!seasonEntry.createdAt || row.createdAt < seasonEntry.createdAt)) {
      seasonEntry.createdAt = row.createdAt;
    }

    const roundEntry = seasonEntry.rounds.get(round) || {
      round,
      points: 0,
      songs: new Map(),
    };
    roundEntry.points += row.points;

    const songEntry = roundEntry.songs.get(trackKey) || {
      title: row.title || "Unknown Title",
      artist: row.artist || "Unknown Artist",
      points: 0,
      submitters: new Set(),
    };
    songEntry.points += row.points;
    songEntry.submitters.add(row.competitor || "Unknown");

    roundEntry.songs.set(trackKey, songEntry);
    seasonEntry.rounds.set(round, roundEntry);
    seasonMap.set(season, seasonEntry);
  });

  return [...seasonMap.values()]
    .map((seasonEntry) => ({
      season: seasonEntry.season,
      points: seasonEntry.points,
      createdAt: seasonEntry.createdAt,
      rounds: [...seasonEntry.rounds.values()]
        .map((roundEntry) => ({
          round: roundEntry.round,
          points: roundEntry.points,
          songs: [...roundEntry.songs.values()]
            .map((songEntry) => ({
              title: songEntry.title,
              artist: songEntry.artist,
              points: songEntry.points,
              submitters: [...songEntry.submitters].sort(),
            }))
            .sort((left, right) => right.points - left.points),
        }))
        .sort((left, right) => right.points - left.points),
    }))
    .sort((left, right) => right.points - left.points)
    .slice(0, limit);
}

function formatPoints(points) {
  return Number(points || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function sortBySeasonName(left, right) {
  return left.season.localeCompare(right.season, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sortSongSearchRows(left, right) {
  const seasonCompare = (left.seasonLabel || "").localeCompare(right.seasonLabel || "", undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (seasonCompare !== 0) {
    return seasonCompare;
  }

  const leftRound = getRoundDisplay(left);
  const rightRound = getRoundDisplay(right);
  const roundCompare = leftRound.localeCompare(rightRound, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (roundCompare !== 0) {
    return roundCompare;
  }

  if (right.points !== left.points) {
    return right.points - left.points;
  }

  return (left.title || "").localeCompare(right.title || "", undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function buildToggleButton(isExpanded) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "leaderboard-toggle";
  button.textContent = isExpanded ? "▾" : "▸";
  return button;
}

function aggregateDuplicateTracks(filteredRows, limit = 200) {
  const byTrackUri = new Map();

  filteredRows.forEach((row) => {
    if (!row.trackUri) {
      return;
    }

    const existing = byTrackUri.get(row.trackUri) || {
      trackUri: row.trackUri,
      title: row.title || "Unknown Title",
      artist: row.artist || "Unknown Artist",
      rows: [],
    };

    existing.rows.push({
      submitter: row.competitor || "Unknown",
      sourceZip: normalizeSourceZip(row.sourceZip),
      points: row.points,
      round: getRoundDisplay(row),
    });

    byTrackUri.set(row.trackUri, existing);
  });

  const duplicates = [];

  byTrackUri.forEach((entry) => {
    if (entry.rows.length <= 1) {
      return;
    }

    entry.rows.forEach((rowInfo) => {
      duplicates.push({
        title: entry.title,
        artist: entry.artist,
        submitter: rowInfo.submitter,
        sourceZip: rowInfo.sourceZip,
        points: rowInfo.points,
        round: rowInfo.round,
        duplicateCount: entry.rows.length,
      });
    });
  });

  return duplicates
    .sort((left, right) => right.duplicateCount - left.duplicateCount)
    .slice(0, limit);
}

function renderKpis(filteredRows) {
  const uniqueTracks = new Set(filteredRows.map((row) => row.trackUri).filter(Boolean));
  const uniqueCompetitors = new Set(filteredRows.map((row) => row.competitor).filter(Boolean));

  kpiSubmissions.textContent = filteredRows.length.toLocaleString();
  kpiTracks.textContent = uniqueTracks.size.toLocaleString();
  kpiCompetitors.textContent = uniqueCompetitors.size.toLocaleString();
}

function renderTopSongsChart(data) {
  if (typeof Chart === "undefined") {
    return;
  }

  const labels = data.map((entry) => [entry.title, entry.artist]);
  const values = data.map((entry) => entry.points);

  if (topSongsChart) {
    topSongsChart.destroy();
  }

  topSongsChart = new Chart(document.getElementById("topSongsChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Total Points",
          data: values,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const points = context.parsed.x;
              return `Total Points: ${points}`;
            },
            afterLabel: (context) => {
              const submitters = data[context.dataIndex]?.submitters || [];
              if (!submitters.length) {
                return "Submitter(s): Unknown";
              }
              return `Submitter(s): ${submitters.join(", ")}`;
            },
          },
        },
      },
    },
  });
}

function renderTopSubmittersChart(data) {
  if (typeof Chart === "undefined") {
    return;
  }

  const labels = data.map((entry) => entry.name);
  const values = data.map((entry) => entry.points);

  if (topSubmittersChart) {
    topSubmittersChart.destroy();
  }

  topSubmittersChart = new Chart(document.getElementById("topSubmittersChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Total Points",
          data: values,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

function renderTopArtistsChart(data) {
  if (typeof Chart === "undefined") {
    return;
  }

  const labels = data.map((entry) => entry.name);
  const values = data.map((entry) => entry.count);

  if (topArtistsChart) {
    topArtistsChart.destroy();
  }

  topArtistsChart = new Chart(document.getElementById("topArtistsChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Submission Count",
          data: values,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

function renderLeaderboardTable(data, bodyElement) {
  bodyElement.innerHTML = "";

  data.forEach((seasonEntry) => {
    const seasonRow = document.createElement("tr");
    seasonRow.className = "leaderboard-season";

    const seasonNameCell = document.createElement("td");
    const seasonExpanded = expandedSeasons.has(seasonEntry.season);
    const seasonToggle = buildToggleButton(seasonExpanded);
    seasonToggle.addEventListener("click", () => {
      if (expandedSeasons.has(seasonEntry.season)) {
        expandedSeasons.delete(seasonEntry.season);
      } else {
        expandedSeasons.add(seasonEntry.season);
      }
      render();
    });
    seasonNameCell.appendChild(seasonToggle);
    const createdLabel = formatDate(seasonEntry.createdAt);
    seasonNameCell.textContent = seasonEntry.season;
    if (createdLabel) {
      const dateMeta = document.createElement("span");
      dateMeta.className = "season-meta";
      dateMeta.textContent = ` (${createdLabel})`;
      seasonNameCell.appendChild(dateMeta);
    }
    seasonNameCell.prepend(seasonToggle);

    const seasonSubmittersCell = document.createElement("td");
    seasonSubmittersCell.textContent = "";

    const seasonPointsCell = document.createElement("td");
    seasonPointsCell.textContent = formatPoints(seasonEntry.points);

    seasonRow.appendChild(seasonNameCell);
    seasonRow.appendChild(seasonSubmittersCell);
    seasonRow.appendChild(seasonPointsCell);
    bodyElement.appendChild(seasonRow);

    if (!seasonExpanded) {
      return;
    }

    seasonEntry.rounds.forEach((roundEntry) => {
      const roundKey = `${seasonEntry.season}||${roundEntry.round}`;
      const roundExpanded = expandedRounds.has(roundKey);

      const roundRow = document.createElement("tr");
      roundRow.className = "leaderboard-round";

      const roundNameCell = document.createElement("td");
      const roundToggle = buildToggleButton(roundExpanded);
      roundToggle.addEventListener("click", () => {
        if (expandedRounds.has(roundKey)) {
          expandedRounds.delete(roundKey);
        } else {
          expandedRounds.add(roundKey);
        }
        render();
      });
      roundNameCell.appendChild(roundToggle);
      roundNameCell.textContent = roundEntry.round;
      roundNameCell.prepend(roundToggle);

      const roundSubmittersCell = document.createElement("td");
      roundSubmittersCell.textContent = "";

      const roundPointsCell = document.createElement("td");
      roundPointsCell.textContent = formatPoints(roundEntry.points);

      roundRow.appendChild(roundNameCell);
      roundRow.appendChild(roundSubmittersCell);
      roundRow.appendChild(roundPointsCell);
      bodyElement.appendChild(roundRow);

      if (!roundExpanded) {
        return;
      }

      roundEntry.songs.forEach((songEntry) => {
        const songRow = document.createElement("tr");
        songRow.className = "leaderboard-song";

        const songNameCell = document.createElement("td");
        songNameCell.textContent = `${songEntry.title} — ${songEntry.artist}`;

        const songSubmittersCell = document.createElement("td");
        songSubmittersCell.textContent = songEntry.submitters.join(", ");

        const songPointsCell = document.createElement("td");
        songPointsCell.textContent = formatPoints(songEntry.points);

        songRow.appendChild(songNameCell);
        songRow.appendChild(songSubmittersCell);
        songRow.appendChild(songPointsCell);
        bodyElement.appendChild(songRow);
      });
    });
  });
}

function renderDuplicateTracksTable(data) {
  duplicateTracksBody.innerHTML = "";

  data.forEach((entry) => {
    const row = document.createElement("tr");

    const songCell = document.createElement("td");
    songCell.textContent = entry.title;

    const artistCell = document.createElement("td");
    artistCell.textContent = entry.artist;

    const submitterCell = document.createElement("td");
    submitterCell.textContent = entry.submitter;

    const sourceZipCell = document.createElement("td");
    sourceZipCell.textContent = entry.sourceZip || "Unknown";

    const pointsCell = document.createElement("td");
    pointsCell.textContent = Number(entry.points || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });

    const roundCell = document.createElement("td");
    roundCell.textContent = entry.round || "Unknown Round";

    row.appendChild(songCell);
    row.appendChild(artistCell);
    row.appendChild(submitterCell);
    row.appendChild(sourceZipCell);
    row.appendChild(pointsCell);
    row.appendChild(roundCell);
    duplicateTracksBody.appendChild(row);
  });
}

function renderSeasonWinnersTable(data) {
  seasonWinnersBody.innerHTML = "";

  data.forEach((entry) => {
    const row = document.createElement("tr");

    const seasonCell = document.createElement("td");
    seasonCell.textContent = entry.season;

    const firstPlaceCell = document.createElement("td");
    firstPlaceCell.textContent = entry.firstPlace.length ? entry.firstPlace.join(", ") : "—";

    const secondPlaceCell = document.createElement("td");
    secondPlaceCell.textContent = entry.secondPlace.length ? entry.secondPlace.join(", ") : "—";

    const thirdPlaceCell = document.createElement("td");
    thirdPlaceCell.textContent = entry.thirdPlace.length ? entry.thirdPlace.join(", ") : "—";

    const pointsCell = document.createElement("td");
    pointsCell.textContent = formatPoints(entry.points);

    row.appendChild(seasonCell);
    row.appendChild(firstPlaceCell);
    row.appendChild(secondPlaceCell);
    row.appendChild(thirdPlaceCell);
    row.appendChild(pointsCell);
    seasonWinnersBody.appendChild(row);
  });
}

function renderSeasonWinsRollupTable(data) {
  seasonWinsRollupBody.innerHTML = "";

  data.forEach((entry) => {
    const row = document.createElement("tr");

    const competitorCell = document.createElement("td");
    competitorCell.textContent = entry.competitor;

    const seasonsWonCell = document.createElement("td");
    seasonsWonCell.textContent = entry.seasonsWon.toLocaleString();

    row.appendChild(competitorCell);
    row.appendChild(seasonsWonCell);
    seasonWinsRollupBody.appendChild(row);
  });
}

function getSearchRows() {
  const searchTerm = cleanText(songSearchInput.value).toLowerCase();
  const allSongs = [...rows].sort(sortSongSearchRows);

  if (!searchTerm) {
    return allSongs;
  }

  return allSongs.filter((row) => {
    const searchable = [
      row.title,
      row.artist,
      row.album,
      row.competitor,
      row.seasonLabel,
      getRoundDisplay(row),
      row.trackUri,
      row.comment,
      row.visibleToVoters,
      row.createdRaw,
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(searchTerm);
  });
}

function renderSongSearchTable() {
  const searchRows = getSearchRows();
  const rowsPerPage = Number(songRowsPerPage.value) || 25;
  const totalPages = Math.max(Math.ceil(searchRows.length / rowsPerPage), 1);
  songSearchPage = Math.min(songSearchPage, totalPages);
  songSearchPage = Math.max(songSearchPage, 1);

  const startIndex = (songSearchPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const rowsToRender = searchRows.slice(startIndex, endIndex);

  songSearchBody.innerHTML = "";
  rowsToRender.forEach((row) => {
    const tr = document.createElement("tr");

    const cells = [
      row.seasonLabel || "Unknown",
      getRoundDisplay(row),
      row.title || "Unknown Title",
      row.artist || "Unknown Artist",
      row.album || "",
      row.competitor || "Unknown",
      formatPoints(row.points),
      row.createdLabel || "",
      row.comment || "",
    ];

    cells.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    songSearchBody.appendChild(tr);
  });

  const fromLabel = searchRows.length ? startIndex + 1 : 0;
  const toLabel = startIndex + rowsToRender.length;

  songSearchCount.textContent = `${searchRows.length.toLocaleString()} matches`;
  songPageInfo.textContent = `Showing ${fromLabel}-${toLabel} • Page ${songSearchPage} of ${totalPages}`;

  songPrevPage.disabled = songSearchPage <= 1;
  songNextPage.disabled = songSearchPage >= totalPages;
}

function render() {
  const filteredRows = getFilteredRows();
  const topSongs = aggregateTopSongs(filteredRows);
  const topSubmitters = aggregateTopSubmitters(filteredRows);
  const topArtists = aggregateTopArtists(filteredRows);
  const seasonWinners = aggregateSeasonWinners(rows);
  const seasonWinsRollup = aggregateSeasonWinsRollup(seasonWinners);
  const leaderboardAllRows = aggregateLeaderboard(rows);
  const seasonsLeaderboard = leaderboardAllRows
    .filter((entry) => entry.season.startsWith("Season "))
    .sort(sortBySeasonName);
  const businessCasualLeaderboard = leaderboardAllRows
    .filter((entry) => entry.season.startsWith("Business Casual "))
    .sort(sortBySeasonName);
  const duplicateTracks = aggregateDuplicateTracks(filteredRows);

  renderKpis(filteredRows);
  renderSeasonWinsRollupTable(seasonWinsRollup);
  renderSeasonWinnersTable(seasonWinners);
  renderTopSongsChart(topSongs);
  renderTopSubmittersChart(topSubmitters);
  renderTopArtistsChart(topArtists);
  renderLeaderboardTable(seasonsLeaderboard, seasonsLeaderboardBody);
  renderLeaderboardTable(businessCasualLeaderboard, businessCasualLeaderboardBody);
  renderDuplicateTracksTable(duplicateTracks);
  renderSongSearchTable();
}

seasonFilter.addEventListener("change", () => {
  buildRoundFilter();
  render();
});

roundFilter.addEventListener("change", render);

resetFiltersButton.addEventListener("click", () => {
  seasonFilter.value = "";
  buildRoundFilter();
  roundFilter.value = "";
  render();
});

songSearchInput.addEventListener("input", () => {
  songSearchPage = 1;
  renderSongSearchTable();
});

songRowsPerPage.addEventListener("change", () => {
  songSearchPage = 1;
  renderSongSearchTable();
});

songPrevPage.addEventListener("click", () => {
  songSearchPage = Math.max(songSearchPage - 1, 1);
  renderSongSearchTable();
});

songNextPage.addEventListener("click", () => {
  songSearchPage += 1;
  renderSongSearchTable();
});

loadData();