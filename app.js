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

function renderStats() {
  const labels = [
    [archive.totals.seasons, "seasons"],
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

function matches(submission, round, query) {
  if (!query) return true;
  const comments = submission.comments.map((c) => `${c.author} ${c.text}`).join(" ");
  return normalized([
    round.name, round.description, submission.title, submission.album,
    submission.artists, submission.submitter, submission.submitterComment, comments,
  ].join(" ")).includes(query);
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
  const query = normalized($("#search").value.trim());
  const root = $("#rounds");
  root.replaceChildren();
  let shownSongs = 0;
  let shownRounds = 0;

  activeSeason.rounds.slice().reverse().forEach((round) => {
    const submissions = round.submissions.filter((submission) => matches(submission, round, query));
    if (!submissions.length) return;
    shownRounds += 1;
    shownSongs += submissions.length;

    const card = make("details", "round-card");
    if (query) card.open = true;
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
  renderPodium(activeSeason.leaderboard);
  renderRounds();
}

function renderAllTime() {
  const root = $("#alltime-table");
  archive.allTimeLeaderboard.forEach((person, index) => {
    const row = make("div", "leader-row");
    row.append(make("span", "leader-rank", String(index + 1).padStart(2, "0")), ma