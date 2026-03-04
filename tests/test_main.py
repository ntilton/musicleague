from musicleague.main import greet


def test_greet() -> None:
    assert greet() == "musicleague"
