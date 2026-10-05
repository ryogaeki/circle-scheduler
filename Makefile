CXX := g++

# この環境のg++ 9.4.0では、C++20指定に -std=c++2a を使う。
CXXFLAGS := -std=c++2a -O2 -Wall -Wextra

# 実行ファイル名と、今ビルド対象にしているC++ファイル。
SCHEDULER_BIN := scheduler
TEST_BIN := scheduler_tests
CPP_SOURCES := \
	cpp/main.cpp \
	cpp/scheduler/input/parse_song_csv.cpp \
	cpp/scheduler/input/build_score_table_from_song_csv.cpp \
	cpp/scheduler/score/base_score.cpp \
	cpp/scheduler/score/day_constraint_score.cpp \
	cpp/scheduler/score/day_spacing_score.cpp \
	cpp/scheduler/score/time_score.cpp \
	cpp/scheduler/score/assignment_request_score.cpp \
	cpp/scheduler/score/schedule_score.cpp \
	cpp/scheduler/score/song_score_breakdown.cpp \
	cpp/scheduler/solver/find_min_blank_count.cpp \
	cpp/scheduler/solver/create_target_counts.cpp \
	cpp/scheduler/solver/create_initial_assignment.cpp \
	cpp/scheduler/solver/neighbor.cpp \
	cpp/scheduler/solver/annealing.cpp \
	cpp/scheduler/solver/candidate_store.cpp \
	cpp/scheduler/solver/solve_balance_comparison.cpp \
	cpp/scheduler/solver/solve_scheduler.cpp

TEST_SOURCES := \
	cpp/tests/scheduler_score_test.cpp \
	cpp/scheduler/score/base_score.cpp \
	cpp/scheduler/score/day_constraint_score.cpp \
	cpp/scheduler/score/day_spacing_score.cpp \
	cpp/scheduler/score/time_score.cpp \
	cpp/scheduler/score/assignment_request_score.cpp \
	cpp/scheduler/score/schedule_score.cpp \
	cpp/scheduler/score/song_score_breakdown.cpp \
	cpp/scheduler/solver/candidate_store.cpp

.PHONY: build run test clean

build:
	$(CXX) $(CXXFLAGS) $(CPP_SOURCES) -o $(SCHEDULER_BIN)

# ビルドして、そのまま実行する。
run: build
	@test -n "$(CSV)" || (echo "CSV=/path/to/file.csv を指定してください。"; exit 1)
	./$(SCHEDULER_BIN) "$(CSV)"

# Web移植前に、採点ルールと候補順が変わっていないか確認する。
test:
	$(CXX) $(CXXFLAGS) $(TEST_SOURCES) -o $(TEST_BIN)
	./$(TEST_BIN)

# 生成した実行ファイルを消す。
clean:
	rm -f $(SCHEDULER_BIN) $(TEST_BIN)
