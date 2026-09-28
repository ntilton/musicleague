const $ = (selector) => document.querySelector(selector);
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const number = new Intl.NumberFormat("en-US");
let archive;
let activeSeason;

const liveSeason = {
  label: "Business Casual",
  description: "The one where the equinox finally broke the heat dome",
  leagueUrl: "https://app.musicleague.com/l/a951c9733a0d4250b1117c0767539aa4/",
  playerCount: 6,
  playerCapacity: 10,
  songsPerRound: 5,
  currentRound: {
    number: 1,
    name: "Sharing is Caring",
    description: "Yes, it's been too long. Surely you've stumbled upon some gems and thought to yourself, \"I can fit this into a future music league round\". Well this is the round for you. 5 songs, no theme, please help us expand our al gore isms.",
    phase: "Voting",
    deadline: "October 3, 2026 at 2:00 PM",
    playlistUrl: "https://open.spotify.com/playlist/0XmVC7EvxVKQMLWE3AXKL4",
  },
};

function renderStats() {
  const labels = [
    [archive.totals.seasons, "completed seasons"],
    [archive.totals.rounds, "rounds"],
    [archive.totals.submissions, "songs"],
    [archive.totals.comments, "comments"],
  ];
  const root = $("#stats");
  labels.forEach(([value, label]) => {
    const stat = make("div", "stat");
    stat.append(make("strong", "", number.format(value)), make("span", "", label));
    root.append(stat);
  });
}

function renderActiveSeason() {
  const root = $("#active-season-card");
  root.replaceChildren();
  const copy = make("div", "active-season-copy");
  copy.append(
    make("p", "kicker", "Active season"),
    make("h2", "", liveSeason.label),
    make("p", "", liveSeason.description),
    make("p", "active-leader", `${liveSeason.playerCount} of ${liveSeason.playerCapacity} players · ${liveSeason.songsPerRound} songs per round`),
  );

  const round = make("div", "active-round");
  round.append(
    make("span", "active-round-label", `Current round · ${liveSeason.currentRound.phase}`),
    make("strong", "", liveSeason.currentRound.name),
    make("p", "", liveSeason.currentRound.description),
    make("span", "active-deadline", `Votes due ${liveSeason.currentRound.deadline}`),
  );

  const actions = make("div", "active-season-actions");
  const explore = make("a", "active-button", "Open Business Casual ↗");
  explore.href = liveSeason.leagueUrl;
  explore.target = "_blank";
  explore.rel = "noreferrer";
  const playlist = make("a", "active-playlist-link", "Current round playlist ↗");
  playlist.href = liveSeason.currentRound.playlistUrl;
  playlist.target = "_blank";
  playlist.rel = "noreferrer";
  actions.append(explore, playlist);
  root.append(copy, round, actions);
}

function renderSeasonOptions() {
  const select = $("#season-select");
  archive.seasons.forEach((season) => {
    const option = make("option", "", `${season.label} · ${season.roundCount} rounds`);
    option.value = season.number;
    select.append(option);
  });
}

function renderPodium(leaderboard) {
  const podium = $("#podium");
  podium.replaceChildren();
  leaderboard.slice(0, 3).forEach((person, index) => {
    const card = make("article", "podium-card");
    card.append(
      make("span", "podium-rank", String(index + 1).padStart(2, "0")),
      make("strong", "podium-name", person.name),
      make("span", "podium-points", `${number.format(person.points)} points`),
    );
    podium.append(card);
  });

  const full = $("#full-standings");
  full.replaceChildren();
  leaderboard.forEach((person, index) => {
    const row = make("div", "standing-row");
    row.append(
      make("span", "", String(index + 1).padStart(2, "0")),
      make("strong", "", person.name),
      make("strong", "", number.format(person.points)),
    );
    full.append(row);
  });
}

function normalized(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function submissionRow(submission) {
  const row = make("article", "submission");
  row.append(make("span", "rank", `#${submission.rank}`));

  const song = make("div", "song");
  song.append(make("strong", "song-title", submission.title), make("span", "song-artist", submission.artists));
  row.append(song);

  const submitter = make("span", "submitter");
  submitter.append("Picked by ", make("strong", "", submission.submitter));
  row.append(submitter, make("span", "points", `${submission.points} pts`));

  const link = make("a", "song-link", "▶");
  link.href = submission.spotifyUrl;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.setAttribute("aria-label", `Play ${submission.title} by ${submission.artists} on Spotify`);
  row.append(link);

  const notesData = [];
  if (submission.submitterComment) notesData.push({ author: submission.submitter, text: submission.submitterComment });
  notesData.push(...submission.comments);
  if (notesData.length) {
    const notes = make("div", "notes");
    notesData.forEach((note) => {
      const p = make("p", "note");
      p.append(make("strong", "", `${note.author}: `), document.createTextNode(note.text));
      notes.append(p);
    });
    row.append(notes);
  }
  return row;
}

function renderRounds() {
  const root = $("#rounds");
  root.replaceChildren();
  let shownSongs = 0;
  let shownRounds = 0;

  activeSeason.rounds.slice().reverse().forEach((round) => {
    const submissions = round.submissions;
    if (!submissions.length) return;
    shownRounds += 1;
    shownSongs += submissions.length;

    const card = make("details", "round-card");
    const summary = make("summary", "round-summary");
    summary.append(make("span", "round-number", `Round ${round.number}`));
    const copy = make("div");
    copy.append(make("h4", "round-title", round.name));
    if (round.description) copy.append(make("p", "round-description", round.description));
    summary.append(copy, make("span", "round-toggle", "+"));
    card.append(summary);

    const content = make("div", "round-content");
    if (round.playlistUrl) {
      const playlist = make("a", "playlist-link", "Listen to the round on Spotify ↗");
      playlist.href = round.playlistUrl;
      playlist.target = "_blank";
      playlist.rel = "noreferrer";
      content.append(playlist);
    }
    const list = make("div", "submission-list");
    submissions.forEach((submission) => list.append(submissionRow(submission)));
    content.append(list);
    card.append(content);
    root.append(card);
  });

  const songLabel = shownSongs === 1 ? "song" : "songs";
  const roundLabel = shownRounds === 1 ? "round" : "rounds";
  $("#result-count").textContent = `${number.format(shownSongs)} ${songLabel} in ${shownRounds} ${roundLabel}`;
  $("#empty-state").hidden = shownSongs !== 0;
}

function renderSeason() {
  const selected = Number($("#season-select").value || archive.seasons[0].number);
  activeSeason = archive.seasons.find((season) => season.number === selected);
  $("#season-kicker").textContent = `Archive volume ${String(activeSeason.number).padStart(2, "0")}`;
  $("#season-title").textContent = activeSeason.label;
  $("#season-meta").textContent = `${activeSeason.roundCount} rounds · ${activeSeason.submissionCount} submissions · ${number.format(activeSeason.voteCount)} votes`;
  const playlistSummary = $("#season-playlists summary");
  playlistSummary.replaceChildren(
    document.createTextNode(`${activeSeason.label} playlists `),
    make("span", "", "+"),
  );
  const playlistRoot = $("#season-playlist-links");
  playlistRoot.replaceChildren();
  activeSeason.rounds.slice().reverse().forEach((round) => {
    if (!round.playlistUrl) return;
    const link = make("a", "", `Round ${round.number} · ${round.name} ↗`);
    link.href = round.playlistUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    playlistRoot.append(link);
  });
  $("#season-playlists").hidden = playlistRoot.childElementCount === 0;
  $("#season-playlists").open = false;
  renderPodium(activeSeason.leaderboard);
  renderRounds();
}

function renderAllTime() {
  const root = $("#alltime-table");
  archive.allTimeLeaderboard.forEach((person, index) => {
    const row = make("div", "leader-row");
    row.append(make("span", "leader-rank", String(index + 1).padStart(2, "0")), make("strong", "leader-name", person.name));
    [[person.points, "points"], [person.submissions, "songs"], [person.seasons, "seasons"]].forEach(([value, label]) => {
      const stat = make("span", "leader-stat");
      stat.append(make("strong", "", number.format(value)), make("span", "", label));
      row.append(stat);
    });
    root.append(row);
  });
}

function allSubmissions() {
  return archive.seasons.flatMap((season) => season.rounds.flatMap((round) =>
    round.submissions.map((submission) => ({ season, round, submission }))));
}

function resultSection(title, items, renderItem) {
  if (!items.length) return null;
  const section = make("section", "result-group");
  const heading = make("div", "result-group-heading");
  heading.append(make("h3", "", title), make("span", "result-total", number.format(items.length)));
  section.append(heading);
  const list = make("div", "result-cards");
  items.forEach((item) => list.append(renderItem(item)));
  section.append(list);
  return section;
}

function matchedFields(fields, query) {
  const seen = new Set();
  return fields.filter(([, value]) => value && normalized(String(value)).includes(query)).filter(([label, value]) => {
    const key = `${label}\n${value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchExcerpt(value, query, limit = 170) {
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const index = normalized(text).indexOf(query);
  const start = Math.max(0, index - Math.floor((limit - query.length) / 2));
  const end = Math.min(text.length, start + limit);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function reasonRow(matches, query) {
  const row = make("div", "match-reasons");
  row.append(make("span", "match-label", "Why this matched"));
  matches.slice(0, 3).forEach(([label, value]) => {
    const reason = make("p", "match-excerpt");
    reason.append(make("strong", "", `${label}: `), document.createTextNode(matchExcerpt(value, query)));
    row.append(reason);
  });
  if (matches.length > 3) row.append(make("span", "match-more", `+${matches.length - 3} more matching fields`));
  return row;
}

function resultSummary(meta, title, detail, foot, matches, query) {
  const summary = make("summary", "search-card-summary");
  const copy = make("div", "search-summary-copy");
  copy.append(make("p", "result-meta", meta), make("h4", "", title), make("p", "result-detail", detail), make("p", "result-foot", foot), reasonRow(matches, query));
  summary.append(copy, make("span", "search-expand", "+"));
  return summary;
}

function songSearchFields(submission) {
  return [
    ["Song title", submission.title], ["Artist", submission.artists], ["Album", submission.album],
    ["Submitter", submission.submitter],
  ];
}

function roundSearchFields(round) {
  return [["Round title", round.name], ["Round description", round.description]];
}

function commentSearchFields(comment) {
  return [["Author", comment.author], [comment.kind === "note" ? "Submission note" : "Comment text", comment.text]];
}

function detailStat(label, value) {
  const stat = make("div", "detail-stat");
  stat.append(make("span", "", label), make("strong", "", value));
  return stat;
}

function searchSongCard({ season, round, submission }, query) {
  const matches = matchedFields(songSearchFields(submission), query);
  const card = make("details", "search-card song-result");
  card.append(resultSummary(
    `${season.label} · Round ${round.number} · ${round.name}`,
    submission.title,
    `${submission.artists}${submission.album ? ` · ${submission.album}` : ""}`,
    `Picked by ${submission.submitter} · ${number.format(submission.points)} points · ${submission.comments.length} comments`,
    matches,
    query,
  ));
  const content = make("div", "search-card-content");
  const stats = make("div", "detail-stats");
  stats.append(
    detailStat("Season", season.label), detailStat("Round", `${round.number} · ${round.name}`),
    detailStat("Submitter", submission.submitter), detailStat("Points", number.format(submission.points)),
    detailStat("Votes received", number.format(submission.voteCount)), detailStat("Round rank", `#${submission.rank}`),
  );
  content.append(stats);
  if (submission.submitterComment || submission.comments.length) {
    const notes = make("div", "search-notes");
    if (submission.submitterComment) {
      const note = make("p", "");
      note.append(make("strong", "", `${submission.submitter} · Submission note: `), document.createTextNode(submission.submitterComment));
      notes.append(note);
    }
    submission.comments.forEach((comment) => {
      const note = make("p", "");
      note.append(make("strong", "", `${comment.author}: `), document.createTextNode(comment.text));
      notes.append(note);
    });
    content.append(notes);
  }
  if (submission.spotifyUrl) {
    const link = make("a", "expanded-link", "Play on Spotify ↗");
    link.href = submission.spotifyUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    content.append(link);
  }
  card.append(content);
  return card;
}

function searchRoundCard({ season, round }, query) {
  const matches = matchedFields(roundSearchFields(round), query);
  const card = make("details", "search-card round-result");
  card.append(resultSummary(
    `${season.label} · Round ${round.number}`,
    round.name,
    round.description || "No round description.",
    `${round.submissions.length} submissions`,
    matches,
    query,
  ));
  const content = make("div", "search-card-content");
  const list = make("div", "mini-song-list");
  round.submissions.forEach((submission) => {
    const row = make("div", "mini-song-row");
    row.append(make("strong", "", submission.title), make("span", "", submission.artists), make("span", "", submission.submitter), make("strong", "", `${submission.points} pts`));
    list.append(row);
  });
  content.append(list);
  if (round.playlistUrl) {
    const link = make("a", "expanded-link", "Open round playlist ↗");
    link.href = round.playlistUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    content.append(link);
  }
  card.append(content);
  return card;
}

function searchPersonCard(person, query) {
  const matches = matchedFields([["Member name", person.name]], query);
  const card = make("details", "search-card person-result");
  card.append(resultSummary(
    "Club member",
    person.name,
    `${number.format(person.points)} all-time points`,
    `${person.submissions} songs across ${person.seasons} seasons`,
    matches,
    query,
  ));
  const content = make("div", "search-card-content");
  const picks = allSubmissions().filter(({ submission }) => submission.submitter === person.name)
    .sort((a, b) => b.submission.points - a.submission.points);
  const stats = make("div", "detail-stats");
  stats.append(detailStat("Points", number.format(person.points)), detailStat("Songs", number.format(person.submissions)), detailStat("Seasons", number.format(person.seasons)), detailStat("Average", `${(person.points / person.submissions).toFixed(1)} pts/song`));
  content.append(stats);
  const list = make("div", "mini-song-list");
  picks.forEach(({ season, submission }) => {
    const row = make("div", "mini-song-row");
    row.append(make("strong", "", submission.title), make("span", "", submission.artists), make("span", "", season.label), make("strong", "", `${submission.points} pts`));
    list.append(row);
  });
  content.append(list);
  card.append(content);
  return card;
}

function searchCommentCard({ season, round, submission, author, text, kind }, query) {
  const matches = matchedFields(commentSearchFields({ author, text, kind }), query);
  const card = make("details", "search-card comment-result");
  const preview = text.length > 150 ? `${text.slice(0, 147)}…` : text;
  card.append(resultSummary(
    `${season.label} · ${submission.title} · ${submission.artists}`,
    `${author}${kind === "note" ? " · Submission note" : " · Comment"}`,
    preview,
    `Round ${round.number}: ${round.name}`,
    matches,
    query,
  ));
  const content = make("div", "search-card-content");
  content.append(make("p", "comment-quote", text));
  const stats = make("div", "detail-stats");
  stats.append(detailStat("Song", submission.title), detailStat("Artist", submission.artists), detailStat("Picked by", submission.submitter), detailStat("Points", number.format(submission.points)));
  content.append(stats);
  if (submission.spotifyUrl) {
    const link = make("a", "expanded-link", "Play song on Spotify ↗");
    link.href = submission.spotifyUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    content.append(link);
  }
  card.append(content);
  return card;
}

function renderGlobalSearch() {
  const raw = $("#global-search").value.trim();
  const query = normalized(raw);
  const type = $("#search-type").value;
  const root = $("#global-results");
  const summary = $("#search-summary");
  root.replaceChildren();

  if (!query) {
    summary.textContent = "Search covers 912 songs, every artist and album, 81 rounds, six members, submission notes, and all 1,331 comments.";
    const prompt = make("div", "search-prompt");
    prompt.append(make("strong", "", "Nothing is excluded."), make("p", "", "Enter a word, name, lyric fragment, title, or phrase. Accents and capitalization do not matter."));
    root.append(prompt);
    return;
  }

  const submissions = allSubmissions();
  const songs = submissions.filter(({ submission }) => matchedFields(songSearchFields(submission), query).length);
  const rounds = archive.seasons.flatMap((season) => season.rounds.map((round) => ({ season, round })))
    .filter(({ round }) => matchedFields(roundSearchFields(round), query).length);
  const people = archive.allTimeLeaderboard.filter((person) => normalized(person.name).includes(query));
  const comments = submissions.flatMap(({ season, round, submission }) => {
    const rows = submission.comments.map((comment) => ({ season, round, submission, author: comment.author, text: comment.text, kind: "comment" }));
    if (submission.submitterComment) rows.unshift({ season, round, submission, author: submission.submitter, text: submission.submitterComment, kind: "note" });
    return rows;
  }).filter((comment) => matchedFields(commentSearchFields(comment), query).length);

  const groups = [
    ["people", "People", people, (item) => searchPersonCard(item, query)],
    ["songs", "Songs", songs, (item) => searchSongCard(item, query)],
    ["rounds", "Rounds", rounds, (item) => searchRoundCard(item, query)],
    ["comments", "Comments & notes", comments, (item) => searchCommentCard(item, query)],
  ];
  const visibleGroups = groups.filter(([key]) => type === "all" || type === key);
  const total = visibleGroups.reduce((sum, [, , items]) => sum + items.length, 0);
  summary.textContent = `${number.format(total)} ${total === 1 ? "result" : "results"} for “${raw}” across the full archive.`;
  visibleGroups.forEach(([, title, items, renderer]) => {
    const section = resultSection(title, items, renderer);
    if (section) root.append(section);
  });
  if (!total) {
    const empty = make("div", "empty-state");
    empty.append(make("span", "", "⌁"), make("h3", "", "No archive matches"), make("p", "", "Try a shorter phrase or switch the result type to Everything."));
    root.append(empty);
  }
}

function reportRow(rank, title, detail, value, maxValue) {
  const row = make("div", "report-row");
  const top = make("div", "report-row-top");
  top.append(make("span", "report-rank", String(rank).padStart(2, "0")));
  const copy = make("div", "report-copy");
  copy.append(make("strong", "", title), make("span", "", detail));
  top.append(copy, make("strong", "report-value", value));
  const bar = make("span", "report-bar");
  bar.style.setProperty("--bar", `${Math.max(4, (Number.parseFloat(value) / maxValue) * 100)}%`);
  row.append(top, bar);
  return row;
}

function renderReports() {
  const entries = allSubmissions();
  const sortedSongs = entries.slice().sort((a, b) => b.submission.points - a.submission.points || b.submission.comments.length - a.submission.comments.length);
  const topSong = sortedSongs[0];
  const mostDiscussed = entries.slice().sort((a, b) =>
    (b.submission.comments.length + Boolean(b.submission.submitterComment)) - (a.submission.comments.length + Boolean(a.submission.submitterComment)))[0];

  const artistMap = new Map();
  entries.forEach(({ submission }) => {
    const key = normalized(submission.artists);
    const item = artistMap.get(key) || { name: submission.artists, picks: 0, points: 0 };
    item.picks += 1;
    item.points += submission.points;
    artistMap.set(key, item);
  });
  const artists = [...artistMap.values()].sort((a, b) => b.picks - a.picks || b.points - a.points || a.name.localeCompare(b.name));

  const margins = archive.seasons.map((season) => ({
    season,
    margin: (season.leaderboard[0]?.points || 0) - (season.leaderboard[1]?.points || 0),
  }));
  const closest = margins.slice().sort((a, b) => a.margin - b.margin)[0];
  const runaway = margins.slice().sort((a, b) => b.margin - a.margin)[0];
  const leader = archive.allTimeLeaderboard[0];
  const reportFacts = [
    ["All-time leader", leader.name, `${number.format(leader.points)} points`],
    ["Single-song record", topSong.submission.title, `${topSong.submission.points} points · ${topSong.submission.artists}`],
    ["Most discussed", mostDiscussed.submission.title, `${mostDiscussed.submission.comments.length + Boolean(mostDiscussed.submission.submitterComment)} notes & comments`],
    ["Most-picked artist", artists[0].name, `${artists[0].picks} submissions`],
  ];
  const factsRoot = $("#report-facts");
  factsRoot.replaceChildren();
  reportFacts.forEach(([label, title, detail]) => {
    const card = make("article", "fact-card");
    card.append(make("span", "", label), make("strong", "", title), make("p", "", detail));
    factsRoot.append(card);
  });

  const songsRoot = $("#top-songs-report");
  songsRoot.replaceChildren();
  sortedSongs.slice(0, 10).forEach((entry, index) => songsRoot.append(reportRow(
    index + 1,
    entry.submission.title,
    `${entry.submission.artists} · ${entry.submission.submitter} · ${entry.season.label}`,
    String(entry.submission.points),
    topSong.submission.points,
  )));

  const artistsRoot = $("#top-artists-report");
  artistsRoot.replaceChildren();
  artists.slice(0, 10).forEach((artist, index) => artistsRoot.append(reportRow(
    index + 1,
    artist.name,
    `${number.format(artist.points)} total points`,
    String(artist.picks),
    artists[0].picks,
  )));

  const wins = new Map();
  archive.seasons.forEach((season) => {
    const winner = season.leaderboard[0]?.name;
    if (winner) wins.set(winner, (wins.get(winner) || 0) + 1);
  });
  const players = archive.allTimeLeaderboard.map((person) => ({ ...person, wins: wins.get(person.name) || 0, average: person.points / person.submissions }));
  const playerRoot = $("#player-report");
  playerRoot.replaceChildren();
  const header = make("div", "player-row player-header");
  ["Player", "Points", "Songs", "Pts / song", "Season wins"].forEach((label) => header.append(make("span", "", label)));
  playerRoot.append(header);
  players.forEach((player) => {
    const row = make("div", "player-row");
    row.append(
      make("strong", "", player.name),
      make("span", "", number.format(player.points)),
      make("span", "", number.format(player.submissions)),
      make("span", "", player.average.toFixed(1)),
      make("span", "", number.format(player.wins)),
    );
    playerRoot.append(row);
  });

  const artistBreadth = new Map();
  entries.forEach(({ submission }) => {
    if (!artistBreadth.has(submission.submitter)) artistBreadth.set(submission.submitter, new Set());
    artistBreadth.get(submission.submitter).add(normalized(submission.artists));
  });
  const catalogBreadth = [...artistBreadth.entries()].sort((a, b) => b[1].size - a[1].size);
  const deepestCatalogCount = catalogBreadth[0][1].size;
  const deepestCatalogNames = catalogBreadth.filter(([, artistsSet]) => artistsSet.size === deepestCatalogCount).map(([name]) => name);
  const peakSeason = archive.seasons.map((season) => ({ season, winner: season.leaderboard[0] }))
    .sort((a, b) => b.winner.points - a.winner.points)[0];

  const findings = [
    ["The closest finish", `${closest.season.label} was decided by ${closest.margin} point${closest.margin === 1 ? "" : "s"}.`],
    ["The biggest runaway", `${runaway.season.label} ended with a ${runaway.margin}-point gap between first and second.`],
    ["The conversation starter", `“${mostDiscussed.submission.title}” by ${mostDiscussed.submission.artists} drew the most written reactions.`],
    ["The repeat favorite", `${artists[0].name} appeared ${artists[0].picks} times and collected ${number.format(artists[0].points)} points.`],
    ["The deepest catalog", `${deepestCatalogNames.join(" and ")} each submitted ${number.format(deepestCatalogCount)} different artists across the archive.`],
    ["The biggest season total", `${peakSeason.winner.name} scored ${number.format(peakSeason.winner.points)} points in ${peakSeason.season.label}.`],
  ];
  const findingsRoot = $("#interesting-findings");
  findingsRoot.replaceChildren();
  findings.forEach(([title, text]) => {
    const card = make("article", "finding-card");
    card.append(make("h4", "", title), make("p", "", text));
    findingsRoot.append(card);
  });
}

function showView(view) {
  ["archive", "search", "reports", "alltime"].forEach((name) => {
    $(`#${name}-view`).hidden = name !== view;
  });
  document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  $(`#${view}-view`).scrollIntoView({ behavior: "smooth", block: "start" });
  if (view === "search") $("#global-search").focus({ preventScroll: true });
}

async function init() {
  try {
    const response = await fetch("data.json?v=20260928-2");
    if (!response.ok) throw new Error("Data unavailable");
    archive = await response.json();
    renderStats();
    renderActiveSeason();
    renderSeasonOptions();
    renderSeason();
    renderAllTime();
    renderGlobalSearch();
    renderReports();
  } catch (error) {
    $("#rounds").append(make("p", "empty-state", "The archive data could not be loaded. Please refresh the page."));
  }
}

$("#season-select").addEventListener("change", () => {
  renderSeason();
});
$("#global-search").addEventListener("input", renderGlobalSearch);
$("#search-type").addEventListener("change", renderGlobalSearch);
$("#toggle-standings").addEventListener("click", (event) => {
  const expanded = event.currentTarget.getAttribute("aria-expanded") === "true";
  event.currentTarget.setAttribute("aria-expanded", String(!expanded));
  event.currentTarget.textContent = expanded ? "Show full table" : "Hide full table";
  $("#full-standings").hidden = expanded;
});
document.querySelectorAll(".nav-tab").forEach((tab) => tab.addEventListener("click", () => showView(tab.dataset.view)));

init();
