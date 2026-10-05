#pragma region Template

#include <bits/stdc++.h>
using namespace std;

using ll  = long long;
using ull = unsigned long long;
using ld  = long double;
using pll = pair<ll, ll>;
using vll   = vector<long long>;
using vvll  = vector<vll>;
using vvvll = vector<vvll>;
using vs    = vector<string>;
using vvs   = vector<vs>;
using vc    = vector<char>;
using vvc   = vector<vc>;
using vvvc  = vector<vvc>;
using vd    = vector<double>;
using vvd   = vector<vd>;
using vvvd  = vector<vvd>;
using vb    = vector<bool>;
using vpll  = vector<pll>;
using vvpll = vector<vpll>;

#define rep(i,n) for (ll i=0; i<(n); i++)
#define reps(i,n) for (ll i=1; i<=(n); i++)
#define rrep(i,n) for (ll i=(n)-1; i>=0; i--)
#define rreps(i,n) for (ll i=(n); i>=1; i--)
#define for_(i,a,b) for (ll i=(a); i<(b); i++)
#define rfor_(i,a,b) for (ll i=(a)-1; i>=(b); i--)

#define n_ cout << endl
#define out(x) cout << (x) << endl
#define out_(x) cout << (x) << " "
#define outs(x) rep(ii,x.size()) {cout << x[ii];}
#define outs_(x) rep(ii,x.size()) {cout << x[ii] << " ";}
#define outss(x) rep(ii,x.size()) {rep(jj,x[ii].size()) {cout << x[ii][jj];} n_;}
#define outss_(x) rep(ii,x.size()) {rep(jj,x[ii].size()) {cout << x[ii][jj] <<" ";} n_;}

#define all(a) a.begin(), a.end()
#define rall(a) a.rbegin(), a.rend()
#define pb push_back

template <typename T> inline bool chmin(T& a, const T& b) {bool c=a>b; if(a>b) a=b; return c;}
template <typename T> inline bool chmax(T& a, const T& b) {bool c=a<b; if(a<b) a=b; return c;}

const long long INF = 1LL << 60;

void INIT()
{
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    //cout << fixed << setprecision(15) << boolalpha;
}

#pragma endregion

//===================================================================================================================================================

// （2）クラス／構造体の定義

// 時間をDouble型で管理し、経過時間も取り出せるクラス
class TimeKeeperDouble {
private:
    std::chrono::high_resolution_clock::time_point start_time_;
    double time_threshold_;
    double now_time_ = 0;

public:
    // 時間制限をミリ秒単位で指定してインスタンスをつくる（クラスのメンバ変数を初期化）
    TimeKeeperDouble(const double time_threshold) // 制限時間を受け取る
        : start_time_(std::chrono::high_resolution_clock::now()), // 今の時間取得
        time_threshold_(time_threshold) {}

    // 経過時間をnow_time_に格納する。
    void setNowTime() {
        auto diff = std::chrono::high_resolution_clock::now() - this->start_time_; // 差を計算
        this->now_time_ =
            std::chrono::duration_cast<std::chrono::microseconds>(diff).count() * 1e-3;  // マイクロ秒（1/1000ミリ秒）⇒ ミリ秒
    }

    // 経過時間をnow_time_に取得する。
    double getNowTime() const { return this->now_time_; }

    // インスタンス生成した時から指定した時間制限を超過したか判定する。
    bool isTimeOver() const { return now_time_ >= time_threshold_; }
};


// いろんな乱数を生成するクラス
class Random {
public:
    std::mt19937 mt_;  // シード0でメルセンヌツイスターの乱数生成器を初期化（最新の高性能なやつ）

    // seedを指定して初期化
    Random(const ll seed = 0) : mt_(std::mt19937(seed)) {}

    // 0 <= x < m (x ∈ Z)
    inline ll nextInt(const ll m) {
        uniform_int_distribution<int> di(0, m - 1);
        return di(mt_);
    }

    // 0 <= x < 1.0 (x ∈ R)
    uniform_real_distribution<double> dd_{0, 1.0};
    inline double nextDouble() { return dd_(mt_); }   // x  <ex> double num = rnd.nextDouble(); 
    inline double nextLog() { return log(dd_(mt_)); } // log(x) （焼きなまし法などで）
};

Random rnd{};  // 型 Random のインスタンス（オブジェクト）を 1 つ作って “rnd” と名付ける

//=================================================================================================================//


    /*↓↓↓↓↓↓↓↓↓↓↓↓ここから下↓↓↓↓↓↓↓↓↓↓↓↓*/


//=================================================================================================================//



struct State {



    // 初期変数

    ll TIME_SIZE, MUSIC_SIZE;
    vs time_names, music_names;
    vvll schedule;     // schedule[ 各時間(ti) ][ 各曲(pi) ] = 〇 = 2, △ = 1, × = 0

    vs date_keys;   // 各 time_names に対応する日付キー（"2/9（月）" 等）
    vll day_sizes;  // 各日の枠数（例: [4,4,8,4,...]）
    vll day_start;  // 各日の開始 time index（例: [0,4,8,16,...]）
    vll time2day;   // 各 time index が何日目かを返す（size == TIME_SIZE）

    // 確定枠関連
    vll locked_assign;            // size == TIME_SIZE。確定枠があるとその曲インデックス（-1 = なし）
    vb   is_locked;               // size == TIME_SIZE。確定枠があるか
    unordered_map<long long,double> override_score; // (ti*1000 + mi) -> 上書きスコア (確定枠は1000)


    priority_queue<pair<double, vll>, vector<pair<double, vll>>, greater<pair<double, vll>>> top_order_que;   // 得点上位N個の並び順、下位から
    static constexpr int TOP_K_MAX = 10000;
    int top_k = TOP_K_MAX;
    unordered_set<unsigned long long> seen_assign; // 重複除去用
    unordered_set<unsigned long long> day_song_max1; // (day, song) は同じ日に2回禁止
    int require_consecutive_song = -1; // 特定曲の連続を要求（-1=無効）
    vll fixed_total_count; // 各曲の最終回数固定（-1=未指定）

    static unsigned long long ds_key(long long day, long long mi) {
        return (unsigned long long)day * 1000000ULL + (unsigned long long)mi;
    }

    static string extract_date_key(string s) {
        s = normalize_label(s);
        size_t pos_paren = s.find("）");
        if (pos_paren != string::npos) {
            return s.substr(0, pos_paren + 1);
        }
        size_t pos_space = s.find(' ');
        if (pos_space != string::npos) return s.substr(0, pos_space);
        return s;
    }

    static unsigned long long hash_assign(const vll& assign) {
        // 64-bit hash (splitmix64)
        unsigned long long x = 0x9e3779b97f4a7c15ULL;
        for (long long v : assign) {
            unsigned long long z = (unsigned long long)(v + 0x9e3779b97f4a7c15ULL);
            z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9ULL;
            z = (z ^ (z >> 27)) * 0x94d049bb133111ebULL;
            z = z ^ (z >> 31);
            x ^= z + 0x9e3779b97f4a7c15ULL + (x << 6) + (x >> 2);
        }
        return x;
    }

    void push_candidate(double score, const vll& assign) {
        if (score <= -1e17) return; // 制約違反などの無効解は保持しない
        unsigned long long h = hash_assign(assign);
        if (seen_assign.find(h) != seen_assign.end()) return;
        seen_assign.insert(h);
        top_order_que.push({score, assign});
        if ((int)top_order_que.size() > top_k) top_order_que.pop();
    }

    // ラベル正規化（空白/引用符/全角スペース/CR/BOM/波ダッシュ差異を吸収）
    static string normalize_label(string s) {
        if (s.size() >= 3 &&
            (unsigned char)s[0] == 0xEF &&
            (unsigned char)s[1] == 0xBB &&
            (unsigned char)s[2] == 0xBF) {
            s.erase(0, 3); // UTF-8 BOM を除去
        }
        s = regex_replace(s, regex("^\\s+|\\s+$"), ""); // 前後空白
        s = regex_replace(s, regex("^\"|\"$"), "");     // 両端の "
        s = regex_replace(s, regex("　"), "");          // 全角スペース
        if (!s.empty() && s.back() == '\r') s.pop_back(); // CR除去（Windows CSV対策）
        // 波ダッシュの揺れ（"～" と "〜"）を統一
        const string wave_full = "～";
        const string wave_jp   = "〜";
        for (size_t pos = 0; (pos = s.find(wave_full, pos)) != string::npos; ) {
            s.replace(pos, wave_full.size(), wave_jp);
            pos += wave_jp.size();
        }
        return s;
    }

    //=================================  最適解計算アルゴリズム  =======================================================================


    void solve(const int64_t time_threshold) {

        auto time_keeper = TimeKeeperDouble(time_threshold);
        seen_assign.clear();

        auto val_base = [&](ll ti, ll mi)->double {
            if (schedule[ti][mi] == 2) return 2.0;
            if (schedule[ti][mi] == 1) return 1.0;
            return -100.0;
        };

        // ラッパー val: override_score があればそれを返す
        auto val = [&](ll ti, ll mi)->double {
            long long key = (long long)ti * 1000LL + (long long)mi;
            auto it = override_score.find(key);
            if (it != override_score.end()) return it->second;
            return val_base(ti, mi);
        };

        // day 情報が未セットなら 4 固定で作るフォールバック
        if (day_sizes.empty()) {
            ll NUM_DAYS = TIME_SIZE / 4;
            day_sizes.assign(NUM_DAYS, 4);
            day_start.assign(NUM_DAYS, 0);
            for (ll d = 0, s = 0; d < NUM_DAYS; ++d) {
                day_start[d] = s;
                s += 4;
            }
            time2day.assign(TIME_SIZE, -1);
            for (ll d = 0; d < NUM_DAYS; ++d) {
                for (ll t = 0; t < day_sizes[d]; ++t) time2day[day_start[d] + t] = d;
            }
        }

        // 目標回数（公平性）
        vll locked_count(MUSIC_SIZE, 0);
        ll locked_total = 0;
        rep(ti, TIME_SIZE) {
            if (is_locked.size() == (size_t)TIME_SIZE && is_locked[ti]) {
                ll mi = locked_assign[ti];
                locked_count[mi]++;
                locked_total++;
            }
        }

        vll song_total(MUSIC_SIZE, 0);
        rep(ti, TIME_SIZE) rep(mi, MUSIC_SIZE) {
            song_total[mi] += (schedule[ti][mi] == 0 ? -100 : schedule[ti][mi]);
        }
        vector<ll> idx(MUSIC_SIZE); iota(idx.begin(), idx.end(), 0);
        sort(idx.begin(), idx.end(), [&](ll a, ll b){ return song_total[a] > song_total[b]; });

        // target: 未確定枠で割り当てる曲数（最終回数ができるだけ均等になるように作る）
        vll target(MUSIC_SIZE, 0);
        vll desired_total(MUSIC_SIZE, 0); // 最終的な各曲の合計回数（確定枠込み）
        vb is_fixed(MUSIC_SIZE, false);
        ll fixed_total_sum = 0;
        rep(mi, MUSIC_SIZE) {
            if (mi < (ll)fixed_total_count.size() && fixed_total_count[mi] >= 0) {
                is_fixed[mi] = true;
                desired_total[mi] = fixed_total_count[mi];
                fixed_total_sum += desired_total[mi];
            }
        }

        if (fixed_total_sum > TIME_SIZE) {
            cerr << "固定回数の合計が時間数を超えています\n";
            return;
        }

        // 非固定曲は、確定枠数を下限として残りを均等化する（差が最小）
        vll cur_nonfixed_total(MUSIC_SIZE, 0);
        ll used_total = fixed_total_sum;
        rep(mi, MUSIC_SIZE) {
            if (is_fixed[mi]) continue;
            cur_nonfixed_total[mi] = locked_count[mi];
            used_total += cur_nonfixed_total[mi];
        }
        if (used_total > TIME_SIZE) {
            cerr << "確定枠が多すぎて回数制約と両立できません\n";
            return;
        }

        ll rem_slots = TIME_SIZE - used_total;
        while (rem_slots > 0) {
            ll best = -1;
            for (ll id : idx) {
                if (is_fixed[id]) continue;
                if (best == -1 || cur_nonfixed_total[id] < cur_nonfixed_total[best]) {
                    best = id;
                }
            }
            if (best == -1) break;
            cur_nonfixed_total[best]++;
            rem_slots--;
        }

        rep(mi, MUSIC_SIZE) {
            if (is_fixed[mi]) desired_total[mi] = fixed_total_count[mi];
            else desired_total[mi] = cur_nonfixed_total[mi];
        }
        rep(mi, MUSIC_SIZE) {
            if (desired_total[mi] < locked_count[mi]) {
                cerr << "回数制約が確定枠を下回っています\n";
                return;
            }
            target[mi] = desired_total[mi] - locked_count[mi];
        }

        // プールを作る（残り割当分）
        vector<int> pool;
        rep(mi, MUSIC_SIZE) rep(k, target[mi]) pool.push_back((int)mi);

        auto is_fixed_count_ok = [&](const vll &assign)->bool {
            vll cnt(MUSIC_SIZE, 0);
            rep(ti, TIME_SIZE) {
                int mi = assign[ti];
                if (mi >= 0) cnt[mi]++;
            }
            rep(mi, MUSIC_SIZE) {
                if (mi < (ll)fixed_total_count.size() && fixed_total_count[mi] >= 0) {
                    if (cnt[mi] != fixed_total_count[mi]) return false;
                }
            }
            return true;
        };

        // スコア計算ヘルパー（割当配列に対する総スコア。-50ペナルティを日ごとに適用）
        auto compute_total_score = [&](const vll &assign)->double {
            if (!is_fixed_count_ok(assign)) return -1e18;
            double sc = 0.0;
            rep(ti, TIME_SIZE) {
                int mi = assign[ti];
                if (mi < 0) continue;
                long long key = (long long)ti * 1000LL + (long long)mi;
                auto it = override_score.find(key);
                if (it != override_score.end()) sc += it->second;
                else sc += val_base(ti, mi);
            }
            // 日ごとの二回目ペナルティ：ある日で同じ曲がちょうど2回なら -50（片方につきではなく日単位で -50）
            for (ll day = 0; day < (ll)day_sizes.size(); ++day) {
                vll cnt(MUSIC_SIZE, 0);
                ll base_t = day_start[day];
                for (ll s = 0; s < day_sizes[day]; ++s) {
                    ll ti = base_t + s;
                    int mi = assign[ti];
                    if (mi >= 0) cnt[mi]++;
                }
                rep(mi, MUSIC_SIZE) {
                    if (cnt[mi] > 2) return -1e18; // 制約違反は強い罰
                    if (cnt[mi] >= 2 && day_song_max1.find(ds_key(day, mi)) != day_song_max1.end()) return -1e18;
                    if (cnt[mi] == 2) sc -= 30.0;
                }
            }
            return sc;
        };

        // --- 初期解生成（シャッフル＋日ごとの貪欲割当） ---
        vll now_assign(TIME_SIZE, -1);
        // まず確定枠を埋める
        rep(ti, TIME_SIZE) {
            if (is_locked.size() == (size_t)TIME_SIZE && is_locked[ti]) now_assign[ti] = locked_assign[ti];
        }
        // 日ごとの既に使われているカウントを作る（確定枠反映済み）
        vector<vll> used_count_per_day(day_sizes.size(), vll(MUSIC_SIZE, 0));
        for (ll day = 0; day < (ll)day_sizes.size(); ++day) {
            ll base_t = day_start[day];
            for (ll s = 0; s < day_sizes[day]; ++s) {
                ll ti = base_t + s;
                if (now_assign[ti] >= 0) used_count_per_day[day][ now_assign[ti] ]++;
            }
        }

        double now_score = -1e100;
        int max_initial_attempts = 3000;
        int attempt = 0;
        bool success_initial = false;
        while (true) {
            time_keeper.setNowTime(); if (time_keeper.isTimeOver()) break;
            attempt++; if (attempt > max_initial_attempts) break;

            // pool をシャッフルして割り当てる（pool は残り必要分）
            vector<int> pool_rem = pool;
            shuffle(pool_rem.begin(), pool_rem.end(), rnd.mt_);

            vll assign = now_assign; // 確定枠は既に入っている
            // コピーした used_count_per_day を使う
            auto used_cnt = used_count_per_day;

            bool fail = false;
            // 各日ごとにスロットを順に埋める
            for (ll day = 0; day < (ll)day_sizes.size() && !fail; ++day) {
                ll base_t = day_start[day];
                for (ll s = 0; s < day_sizes[day] && !fail; ++s) {
                    ll ti = base_t + s;
                    if (assign[ti] >= 0) continue; // 確定枠など埋まっている
                    // pool_rem から日内で used_cnt < 2 のものを貪欲に選ぶ（その時間の val が最大のもの）
                    int best_pos = -1; double best_v = -1e200;
                    for (int p = 0; p < (int)pool_rem.size(); ++p) {
                        int mi = pool_rem[p];
                        if (used_cnt[day][mi] >= 2) continue; // 日内最大2回まで
                        if (used_cnt[day][mi] >= 1 && day_song_max1.find(ds_key(day, mi)) != day_song_max1.end()) continue;
                        double v = val(ti, mi);
                        if (v > best_v) { best_v = v; best_pos = p; }
                    }
                    if (best_pos == -1) { fail = true; break; }
                    int pick = pool_rem[best_pos];
                    assign[ti] = pick;
                    used_cnt[day][pick]++;
                    pool_rem.erase(pool_rem.begin() + best_pos);
                }
            }

            if (!fail) {
                double sc = compute_total_score(assign);
                if (sc <= -1e17) continue;
                now_assign = assign;
                now_score = sc;
                success_initial = true;
                push_candidate(now_score, now_assign);
                break;
            }
        }

        // フォールバック（簡易貪欲、確定枠を優先）
        if (!success_initial) {
            vll assign(TIME_SIZE, -1);
            rep(ti, TIME_SIZE) if (is_locked.size() == (size_t)TIME_SIZE && is_locked[ti]) assign[ti] = locked_assign[ti];

            vll remain = target;
            // (remain は pool を作る前に target から locked_count を差し引いてある)
            // 日ごとに remain>0 の曲だけを使って埋める（回数制約を守る）
            bool fail = false;
            for (ll day = 0; day < (ll)day_sizes.size(); ++day) {
                ll base_t = day_start[day];
                vll used(MUSIC_SIZE, 0);
                // 既に確定枠で使われている分を反映
                for (ll s = 0; s < day_sizes[day]; ++s) {
                    ll ti = base_t + s;
                    if (assign[ti] >= 0) used[ assign[ti] ]++;
                }
                for (ll s = 0; s < day_sizes[day]; ++s) {
                    ll ti = base_t + s;
                    if (assign[ti] >= 0) continue;
                    int best_m = -1; double best_v = -1e200;
                    // remain>0 の曲から選ぶ
                    rep(mi, MUSIC_SIZE) {
                        if (remain[mi] <= 0) continue;
                        if (used[mi] >= 2) continue;
                        if (used[mi] >= 1 && day_song_max1.find(ds_key(day, mi)) != day_song_max1.end()) continue;
                        double v = val(ti, mi);
                        if (v > best_v) { best_v = v; best_m = (int)mi; }
                    }
                    if (best_m == -1) { fail = true; break; }
                    assign[ti] = best_m;
                    used[best_m]++;
                    remain[best_m]--;
                }
                if (fail) break;
            }
            if (!fail) {
                rep(mi, MUSIC_SIZE) {
                    if (remain[mi] != 0) { fail = true; break; }
                }
            }
            if (!fail) {
                double sc = compute_total_score(assign);
                if (sc > -1e17) {
                    now_assign = assign;
                    now_score = sc;
                    success_initial = true;
                    push_candidate(now_score, now_assign);
                }
            }
        }

        if (!success_initial) return;

        // ========== 焼きなまし本体 ==========
        double start_temp = 5.0, end_temp = 1e-4;

        // 探索対象は「確定枠でない時間」だけ
        vll unlocked_indices;
        rep(ti, TIME_SIZE) if (!(is_locked.size() == (size_t)TIME_SIZE && is_locked[ti])) unlocked_indices.push_back(ti);

        // もし探索可能なスロットが 2 未満なら探索不可（確定枠が多すぎ）
        if (unlocked_indices.size() >= 2) {
            while (1) {
                time_keeper.setNowTime();
                if (time_keeper.isTimeOver()) break;

                double t_elapsed = time_keeper.getNowTime();
                double temp = start_temp + (end_temp - start_temp) * (t_elapsed / (double)time_threshold);
                if (temp < end_temp) temp = end_temp;
                double diff_threshold = temp * rnd.nextLog();

                // pick two unlocked random times
                int idx1 = rnd.nextInt((int)unlocked_indices.size());
                int idx2 = rnd.nextInt((int)unlocked_indices.size() - 1);
                if (idx2 >= idx1) ++idx2;
                int ti = (int)unlocked_indices[idx1];
                int tj = (int)unlocked_indices[idx2];

                int ai = (int)now_assign[ti], aj = (int)now_assign[tj];
                if (ai == aj) continue;

                ll day_i = time2day[ti], day_j = time2day[tj];

                // swap 後に日内カウントが <= 2 になるかチェック
                bool ok = true;
                // 現在の日カウントを集める（小さい日ごと領域なのでコストは小さい）
                vll cnti(MUSIC_SIZE, 0), cntj(MUSIC_SIZE, 0);
                {
                    ll base_t = day_start[day_i];
                    for (ll s = 0; s < day_sizes[day_i]; ++s) {
                        ll t = base_t + s;
                        int cur = (int)now_assign[t];
                        if (t == ti) cur = aj; // swap 想定
                        cnti[cur]++;
                    }
                    // チェック
                    if (cnti[ai] > 2 || cnti[aj] > 2) ok = false;
                    if (day_song_max1.find(ds_key(day_i, ai)) != day_song_max1.end() && cnti[ai] >= 2) ok = false;
                    if (day_song_max1.find(ds_key(day_i, aj)) != day_song_max1.end() && cnti[aj] >= 2) ok = false;
                }
                if (!ok) continue;
                if (day_j != day_i) {
                    ll base_t = day_start[day_j];
                    for (ll s = 0; s < day_sizes[day_j]; ++s) {
                        ll t = base_t + s;
                        int cur = (int)now_assign[t];
                        if (t == tj) cur = ai;
                        cntj[cur]++;
                    }
                    if (cntj[ai] > 2 || cntj[aj] > 2) ok = false;
                    if (day_song_max1.find(ds_key(day_j, ai)) != day_song_max1.end() && cntj[ai] >= 2) ok = false;
                    if (day_song_max1.find(ds_key(day_j, aj)) != day_song_max1.end() && cntj[aj] >= 2) ok = false;
                }

                if (!ok) continue;

                // 次状態スコアを計算（簡潔さのため全スコア再計算）
                vll next_assign = now_assign;
                swap(next_assign[ti], next_assign[tj]);
                double next_score = compute_total_score(next_assign);
                double diff = next_score - now_score;

                if (diff > diff_threshold) {
                    // accept
                    now_assign.swap(next_assign);
                    now_score = next_score;

                    push_candidate(now_score, now_assign);
                }
            }
        }

        // done
        return;
    }






    //============================  入力を受け取り、ファイルから情報を取得  =======================================================
    void input() {
        string FALE_NAME;
        cout<<"時間数: "; cin>>TIME_SIZE;
        cout<<"楽曲数: "; cin>>MUSIC_SIZE;
        cout<<"ファイル名: "; cin>>FALE_NAME;
        cout<<"出力件数(1〜"<<TOP_K_MAX<<"): ";
        cin>>top_k;
        if (top_k <= 0) top_k = TOP_K_MAX;
        if (top_k > TOP_K_MAX) top_k = TOP_K_MAX;


        ifstream yotei_file(FALE_NAME);
        string line;

        if (!yotei_file.is_open()) {cerr << "CSVファイルを開けませんでした\n"; return;}
        
        //==========  poeple_names 取得  ========
        
        // 1行目はタイトルなので捨てる
        getline(yotei_file, line);

        // 2行目は説明文（複数行）なので "日程" が来るまで捨てる
        while (getline(yotei_file, line)) {
            if (line.rfind("日程", 0) == 0) break;
        }

        // line には "日程,岡田涼雅(2),..." が入っている
        stringstream ss(line);
        string col;

        while (getline(ss, col, ',')) {
            col = regex_replace(col, regex("\\(.*?\\)|（.*?）"), ""); // 括弧（全角/半角）を削除 ("" に 置換)
            col = regex_replace(col, regex("^\\s+|\\s+$"), "");       // 前後スペース削除

            col = regex_replace(col, regex("^\\s+|\\s+$"), ""); // 前後空白
            col = regex_replace(col, regex("^\"|\"$"), "");     // 両端の "
            col = regex_replace(col, regex("　"), "");          // 全角スペース
            if (!col.empty() && col.back() == '\r') col.pop_back(); // CR除去（Windows CSV対策）

            if(col != "日程") music_names.pb(col);
        }


        //============ schedule 取得  ==========
        
        while (getline(yotei_file, line)) {
            if (line.empty()) continue;

            stringstream ss(line);
            string col;

            // 時間文字列を取得
            getline(ss, col, ',');
            if(col == "コメント") break;
            col = normalize_label(col);
            time_names.pb(col);

            // time_names に入れた文字列から「日付キー」を取り出して保存します。
            // 例: "2/9（月）18:00〜" -> "2/9（月）"
            {
                string date_key = col;
                size_t pos_paren = date_key.find("）");
                if (pos_paren != string::npos) {
                    // 右括弧までを日付キーとする
                    date_key = date_key.substr(0, pos_paren + 1);
                } else {
                    // 万が一フォーマットが少し違う場合は、時間以降を削る簡易処理
                    size_t pos_space = date_key.find(' ');
                    if (pos_space != string::npos) date_key = date_key.substr(0, pos_space);
                }
                date_keys.push_back(date_key);
            }

            vll row;

            while (getline(ss, col, ',')) {
                col = regex_replace(col, regex("^\\s+|\\s+$"), ""); // 前後のスペース削除

                ll val;
                if (col == "◯") val = 2;
                else if (col == "△") val = 1;
                else if (col == "×") val = 0;
                else {cerr << "不明な記号\n"; return;}
                
                row.pb(val);
            }   
            
            schedule.pb(row);
        }

        day_sizes.clear();
        day_start.clear();
        time2day.assign((ll)date_keys.size(), -1);

        for (ll i = 0; i < (ll)date_keys.size();) {
            ll j = i + 1;
            while (j < (ll)date_keys.size() && date_keys[j] == date_keys[i]) j++;
            day_start.push_back(i);
            day_sizes.push_back(j - i);
            ll day_idx = (ll)day_start.size() - 1;
            for (ll t = i; t < j; ++t) time2day[t] = day_idx;
            i = j;
        }

        // 確定枠まわりの初期化
        locked_assign.assign(TIME_SIZE, -1);
        is_locked.assign(TIME_SIZE, false);
        override_score.clear();
        day_song_max1.clear();
        fixed_total_count.assign(MUSIC_SIZE, -1);
    }

    // 解を出力する
    void output(ostream& os, ll limit) {
        limit = min(limit, (ll)top_order_que.size());
        rep(i,limit){
            if(top_order_que.empty()) break;
            auto [score, best_order] = top_order_que.top();
            top_order_que.pop();
            os<<"第"<<(limit-i)<<"候補"<<endl;
            os<<"スコア："<<score<<"点"<<endl;
            
            os<<"回数：";
            vll music_cnt2(MUSIC_SIZE);
            rep(ti,TIME_SIZE){
                music_cnt2[best_order[ti]]++;
            }
            rep(ii, music_cnt2.size()) {os << music_cnt2[ii] << " ";}
            os << endl;

            rep(ti, TIME_SIZE){
                if (ti > 0) {
                    string cur_day = (ti < (ll)date_keys.size() ? date_keys[ti] : "");
                    string prev_day = (ti - 1 < (ll)date_keys.size() ? date_keys[ti - 1] : "");
                    if (!cur_day.empty() && cur_day != prev_day) os << "\n";
                }
                string mark;
                if (is_locked.size() == (size_t)TIME_SIZE && is_locked[ti] && best_order[ti] == locked_assign[ti]) {
                    mark = "確";
                } else {
                    ll v = schedule[ti][best_order[ti]];
                    if (v == 2) mark = "◯";
                    else if (v == 1) mark = "△";
                    else mark = "×";
                }
                os<<time_names[ti]<<" "<<mark<<" "<<music_names[best_order[ti]]<<endl;
            }
            os << endl;
        }

        return;
    }

    // 指定曲が同じ日内で隣り合う時間に2回ある候補だけ残す
    void filter_require_consecutive_pair() {
        if (require_consecutive_song < 0) return;
        priority_queue<pair<double, vll>, vector<pair<double, vll>>, greater<pair<double, vll>>> new_q;
        unordered_set<unsigned long long> new_seen;

        auto has_pair = [&](const vll& assign)->bool {
            if (assign.empty()) return false;
            for (ll ti = 1; ti < (ll)assign.size(); ++ti) {
                if (!time2day.empty() && time2day.size() == assign.size()) {
                    if (time2day[ti] != time2day[ti - 1]) continue; // 日跨ぎは無視
                }
                if (assign[ti] == require_consecutive_song &&
                    assign[ti - 1] == require_consecutive_song) return true;
            }
            return false;
        };

        while (!top_order_que.empty()) {
            auto cur = top_order_que.top();
            top_order_que.pop();
            if (!has_pair(cur.second)) continue;
            unsigned long long h = hash_assign(cur.second);
            if (new_seen.find(h) != new_seen.end()) continue;
            new_seen.insert(h);
            new_q.push(cur);
            if ((int)new_q.size() > top_k) new_q.pop();
        }

        top_order_que.swap(new_q);
        seen_assign.swap(new_seen);
    }
    void lock_assignments() {
        // 標準入力で確定枠を繰り返し受け付ける
        // 注意: main() で input() の直後に呼ぶ想定のため、直前の改行を吸収
        string dummy;
        getline(cin, dummy); // 直前の残り改行を消す（安全のため）

        // 既存の確定枠カウント（日ごと・曲ごと）
        vector<vll> locked_cnt_day;
        if (!day_sizes.empty()) {
            locked_cnt_day.assign(day_sizes.size(), vll(MUSIC_SIZE, 0));
            rep(ti, TIME_SIZE) {
                if (is_locked.size() == (size_t)TIME_SIZE && is_locked[ti]) {
                    ll mi = locked_assign[ti];
                    ll day = (time2day.size() == (size_t)TIME_SIZE ? time2day[ti] : -1);
                    if (day >= 0) locked_cnt_day[day][mi]++;
                }
            }
        }

        cout << "確定枠を登録します。時間文字列と曲名を完全一致で入力してください。\n";
        cout << "同じ日で同じ曲が3回目以降の場合は「希望枠（スコア1000）」として登録され、固定はされません。\n";
        cout << "終了するには時間文字列で q を入力してください。\n";

        while (true) {
            string time_str;
            cout << "時間文字列（例: 2/9（月）18:00〜）: ";
            getline(cin, time_str);
            time_str = normalize_label(time_str);
            if (time_str == "q" || time_str == "Q") break;
            if (time_str.size() == 0) {
                // 空行はスキップ（コピペ時の空行対策）
                continue;
            }

            string music_str;
            cout << "曲名（完全一致）: ";
            getline(cin, music_str);
            if (music_str.size() == 0) {
                cout << "曲名が空です。やり直してください。\n";
                continue;
            }
            music_str = normalize_label(music_str);

            // 時刻インデックスを探す（完全一致）
            ll ti = -1;
            rep(i, (ll)time_names.size()) {
                if (time_names[i] == time_str) { ti = i; break; }
            }
            if (ti == -1) {
                cout << "時間が見つかりません: '" << time_str << "'\n";
                continue;
            }

            // 曲インデックスを探す（完全一致）
            ll mi = -1;
            rep(i, (ll)music_names.size()) {
                if (music_names[i] == music_str) { mi = i; break; }
            }
            if (mi == -1) {
                cout << "曲名が見つかりません: '" << music_str << "'\n";
                continue;
            }

            ll day = (time2day.size() == (size_t)TIME_SIZE ? time2day[ti] : -1);
            bool has_day = (!day_sizes.empty() && day >= 0);

            bool hard_lock = true;
            if (has_day) {
                int new_count = locked_cnt_day[day][mi] + (is_locked[ti] ? 0 : 1);
                if (is_locked[ti]) {
                    ll old = locked_assign[ti];
                    if (old == mi) {
                        cout << "すでに同じ曲が登録されています。\n";
                        continue;
                    }
                    // 置き換えのため一旦 old を減らす
                    locked_cnt_day[day][old]--;
                    new_count = locked_cnt_day[day][mi] + 1;
                }
                if (new_count > 2) hard_lock = false;
            }

            // 希望枠・確定枠の登録
            long long key = (long long)ti * 1000LL + (long long)mi;
            override_score[key] = 1000.0; // 指定ペアの評価を 1000 にする

            if (hard_lock) {
                if (has_day) locked_cnt_day[day][mi]++;
                is_locked[ti] = true;
                locked_assign[ti] = mi;
                cout << "登録しました: " << time_names[ti] << " -> " << music_names[mi] << " (スコア1000・固定)\n";
            } else {
                is_locked[ti] = false;
                locked_assign[ti] = -1;
                cout << "登録しました: " << time_names[ti] << " -> " << music_names[mi] << " (スコア1000・希望枠)\n";
            }
        }
        cout << "確定枠登録を終了します。\n";
    }

    void input_no_double_day_song() {
        cout << "同じ日に同じ曲を2回入れたくない条件を登録します。\n";
        cout << "日付(例: 2/9（月）) または時間文字列を入力してください。終了は q。\n";
        while (true) {
            string day_str;
            cout << "日付/時間: ";
            getline(cin, day_str);
            day_str = normalize_label(day_str);
            if (day_str == "q" || day_str == "Q") break;
            if (day_str.size() == 0) continue;

            string date_key = extract_date_key(day_str);
            ll day_idx = -1;
            rep(i, (ll)date_keys.size()) {
                if (date_keys[i] == date_key) { day_idx = time2day[i]; break; }
            }
            if (day_idx == -1) {
                cout << "日付が見つかりません: '" << date_key << "'\n";
                continue;
            }

            string music_str;
            cout << "曲名（完全一致）: ";
            getline(cin, music_str);
            music_str = normalize_label(music_str);
            if (music_str.size() == 0) {
                cout << "曲名が空です。やり直してください。\n";
                continue;
            }
            ll mi = -1;
            rep(i, (ll)music_names.size()) {
                if (music_names[i] == music_str) { mi = i; break; }
            }
            if (mi == -1) {
                cout << "曲名が見つかりません: '" << music_str << "'\n";
                continue;
            }

            day_song_max1.insert(ds_key(day_idx, mi));
            cout << "登録しました: " << date_key << " / " << music_names[mi] << " は1回まで\n";
        }

        // 既に確定枠で2回以上入っている場合は警告
        if (!day_song_max1.empty()) {
            vector<vll> cnt(day_sizes.size(), vll(MUSIC_SIZE, 0));
            rep(ti, TIME_SIZE) {
                if (is_locked.size() == (size_t)TIME_SIZE && is_locked[ti]) {
                    ll mi = locked_assign[ti];
                    ll day = time2day[ti];
                    if (day >= 0) cnt[day][mi]++;
                }
            }
            for (ll day = 0; day < (ll)day_sizes.size(); ++day) {
                rep(mi, MUSIC_SIZE) {
                    if (cnt[day][mi] >= 2 &&
                        day_song_max1.find(ds_key(day, mi)) != day_song_max1.end()) {
                        cout << "警告: 確定枠だけで条件違反の可能性があります ("
                             << date_keys[day_start[day]] << " / " << music_names[mi] << ")\n";
                    }
                }
            }
        }
    }

    void input_require_consecutive_song() {
        cout << "特定の曲が同じ日で2つ連続する候補だけ残す条件を入力できます。\n";
        cout << "曲名（完全一致）を入力してください。不要なら q。\n";
        string music_str;
        cout << "曲名: ";
        getline(cin, music_str);
        music_str = normalize_label(music_str);
        if (music_str == "q" || music_str == "Q" || music_str.empty()) {
            require_consecutive_song = -1;
            return;
        }
        ll mi = -1;
        rep(i, (ll)music_names.size()) {
            if (music_names[i] == music_str) { mi = i; break; }
        }
        if (mi == -1) {
            cout << "曲名が見つかりません: '" << music_str << "'\n";
            require_consecutive_song = -1;
            return;
        }
        require_consecutive_song = (int)mi;
        cout << "条件登録: " << music_names[mi] << " が同じ日で2つ連続\n";
    }

    void input_fixed_song_count() {
        cout << "曲ごとの最終回数固定を登録できます。\n";
        cout << "曲名（完全一致）を入力し、次に回数を入力してください。終了は q。\n";
        while (true) {
            string music_str;
            cout << "曲名: ";
            getline(cin, music_str);
            music_str = normalize_label(music_str);
            if (music_str == "q" || music_str == "Q") break;
            if (music_str.empty()) continue;

            ll mi = -1;
            rep(i, (ll)music_names.size()) {
                if (music_names[i] == music_str) { mi = i; break; }
            }
            if (mi == -1) {
                cout << "曲名が見つかりません: '" << music_str << "'\n";
                continue;
            }

            string num_str;
            cout << "固定回数: ";
            getline(cin, num_str);
            num_str = normalize_label(num_str);
            if (num_str.empty()) {
                cout << "回数が空です。やり直してください。\n";
                continue;
            }

            ll cnt = -1;
            try {
                cnt = stoll(num_str);
            } catch (...) {
                cout << "回数は整数で入力してください。\n";
                continue;
            }
            if (cnt < 0 || cnt > TIME_SIZE) {
                cout << "回数は 0 以上 " << TIME_SIZE << " 以下で入力してください。\n";
                continue;
            }

            fixed_total_count[mi] = cnt;
            cout << "登録しました: " << music_names[mi] << " = " << cnt << " 回\n";
        }
    }


};

//=================================================================================================================//
// （5）main 関数
int main() {
    State state;
    state.input(); // 入力を受け取る
    state.lock_assignments(); // 確定枠
    state.input_fixed_song_count(); // 曲ごとの最終回数固定
    state.input_no_double_day_song(); // 日付×曲の「2回禁止」
    state.input_require_consecutive_song(); // 特定曲の連続条件
    INIT();
    state.solve(5000);
    state.filter_require_consecutive_pair();
    ofstream ofs("result.txt");
    if (!ofs.is_open()) {
        cerr << "result.txt を開けませんでした\n";
        return 1;
    }
    state.output(ofs, state.top_k); // 解をファイルに出力する
    return 0;
}

//=================================================================================================================//

/*
    ex>
    44
    11
    chouseisan-attendance-2026-02-06-16-52-37.csv

    10000

    2/27（金）10:00〜
    卒業生曲

    2/18（水）17:00〜
    はなのな

    2/20（金）17:00〜
    キズナミュージック♪

    2/27（金）17:00〜
    キズナミュージック♪

    2/27（金）11:00〜
    毛糸のカービィ

    2/27（金）12:00〜
    毛糸のカービィ

    2/27（金）13:00〜
    毛糸のカービィ

    2/27（金）14:00〜
    毛糸のカービィ

    q

    2/9（月）
    星座になれたら

    q

    4年曲
*/

/*
    ex>
    24
    11
    chouseisan-attendance-2026-02-25-20-06-53.csv

    10000

    3/2（月）17:00〜
    花の名

    3/4（水）13:00〜
    キズナミュージック♪

    3/4（水）14:00〜
    キズナミュージック♪

    3/4（水）14:00〜
    2年曲

    3/4（水）15:00〜
    2年曲
    
    q
    
    人にやさしく
    2

    q

    q

*/


/*

3/23（月）10:00〜
3/23（月）11:00〜
3/23（月）12:00〜
3/23（月）13:00〜
3/23（月）14:00〜
3/23（月）15:00〜
3/23（月）16:00〜
3/23（月）17:00〜
3/27（金）10:00〜
3/27（金）11:00〜
3/27（金）12:00〜
3/27（金）13:00〜
3/27（金）14:00〜
3/27（金）15:00〜
3/27（金）16:00〜
3/27（金）17:00〜
3/30（月）10:00〜
3/30（月）11:00〜
3/30（月）12:00〜
3/30（月）13:00〜
3/30（月）14:00〜
3/30（月）15:00〜
3/30（月）16:00〜
3/30（月）17:00〜
4/1（水）10:00〜
4/1（水）11:00〜
4/1（水）12:00〜
4/1（水）13:00〜
4/1（水）14:00〜
4/1（水）15:00〜
4/1（水）16:00〜
4/1（水）17:00〜

*/

/*

怪獣
シロクマ
Take Five
前前前世
Mela！
透明人間

*/

/*
36
6
chouseisan-attendance-2026-03-30-17-07-49.csv

10000

4/13（月）20:15〜
怪獣
q
q
q

*/