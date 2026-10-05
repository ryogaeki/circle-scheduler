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

#pragma endregion

//===================================================================================================================================================

// void out_comb(vll &);

// void comb(ll n, ll r){
//     vll sel(n, 0);
//     rep(i,r) sel[n-1-i] = 1;
//     do{
//         out_comb(sel);
//       }while(next_permutation(all(sel)));
// }

priority_queue<pair<double, vll>, vector<pair<double, vll>>, greater<pair<double, vll>>> top_order_que;   // 得点上位N個の並び順、下位から
//vvd  sum_points(8, vd(12, 0));   // sum_points[ 各時間(ti) ][ 各楽曲(mi) ] = 合計ポイント

void Print_in(string S, ll &x){
    cout<<S<<":";
    cin>>x;
}

int main() {
    ll TIME_SIZE, MUSIC_SIZE, PEOPLE_SIZE;
    
    Print_in("時間数", TIME_SIZE);
    Print_in("楽曲数", MUSIC_SIZE);
    Print_in("人員数", PEOPLE_SIZE);
    

    //============================  ファイルから情報を取得  ========================================================================

    vs	time_names, music_names, poeple_names;
    vvll schedule;     // schedule[ 各時間(ti) ][ 各人名(pi) ] = 〇 = 2, △ = 1, × = 0

    ifstream yotei_file("chouseisan-attendance-2026-05-10-17-35-18.csv");
    string line;

    if (!yotei_file.is_open()) {cerr << "CSVファイルを開けませんでした\n"; return 1;}
    
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

        if(col != "日程") poeple_names.pb(col);
    }


    //============ schedule 取得  ==========
    
    while (getline(yotei_file, line)) {
        if (line.empty()) continue;

        stringstream ss(line);
        string col;

        // 時間文字列を取得
        getline(ss, col, ',');
        if(col == "コメント") break;
        time_names.pb(col);

        vll row;

        while (getline(ss, col, ',')) {
            col = regex_replace(col, regex("^\\s+|\\s+$"), ""); // 前後のスペース削除

            ll val;
            if (col == "◯") val = 2;
            else if (col == "△") val = 1;
            else if (col == "×") val = 0;
            else {cerr << "不明な記号\n"; return 1;}
            
            row.pb(val);
        }   
        
        schedule.pb(row);
    }

    //===============================  スコア入力 ====================================================================================
    
    vvvll points(TIME_SIZE, vvll(MUSIC_SIZE, vll(PEOPLE_SIZE, 0)));   // points[ 各時間(ti) ][ 各楽曲(mi) ][ 各人名(pi) ] = ポイント
    vvd  sum_points(TIME_SIZE, vd(MUSIC_SIZE, 0));   // sum_points[ 各時間(ti) ][ 各楽曲(mi) ] = 合計ポイント

    // 楽曲名, リーダー, ドラム, ベース, その他
    vvs member_name_list = {
        {"紋白蝶","田口由梨奈","田口由梨奈","上村将斗","岡田涼雅","日比野将都"},
        {"四季の唄","畑凜太郎","杉浦沙雪","畑凜太郎","岡田涼雅","河原田悠雅"},
        {"アイデア","岩越七迦","岩越七迦","宮崎真優","上村将斗"},
        {"エマ","南原和季","畠中優輔","田井榛乃","佐々木渓史","南原和季","望月理沙"},
        {"青と夏","","川出友菜","","木場本稜司","木本遼己","水谷都"},
        {"115万キロのフィルム","畠中優輔","山河龍平","安田梨乃","増田悠那","足立啓悟","杉浦沙雪","杉浦沙雪","杉浦沙雪"}
    };

    // リーダー, ドラム, ベース, その他
    vvll member_list;

    for(vs v : member_name_list){
        vll buff;
        music_names.pb(v[0]);
        for(ll i=1; i<v.size(); i++){
            if(v[i] == "") {
                buff.pb(-2);
                continue;
            }
            ll flg = 0;
            rep(pi, PEOPLE_SIZE){
                if(v[i] == poeple_names[pi]) {
                    buff.pb(pi);
                    flg = 1;
                    break;
                }
            }
            if(!flg) buff.pb(-1);
        }
        member_list.pb(buff);
    }

    //outss_(member_list);

    vll member_cnt(member_list.size()); // 各楽曲の人数
    rep(i,member_list.size()){
        member_cnt[i] = member_list[i].size();
    }
    
    rep(ti, TIME_SIZE){
        rep(mi, MUSIC_SIZE){
            for(ll i=0; i<member_list[mi].size(); i++){
                ll pi = member_list[mi][i];

                ll score = 0;
                if     (i == 0) score = 30;
                else if(i == 1) score = 20;
                else if(i == 2) score = 15;
                else            score = 10;

                if(pi < 0){
                    sum_points[ti][mi] += 0 * score;
                    continue;
                }

                points[ti][mi][pi] += schedule[ti][pi] * score;
            }
        }
    }


    //=================================  最適解計算アルゴリズム  =======================================================================

   // priority_queue<pair<double, vll>, vector<pair<double, vll>>, greater<pair<double, vll>>> top_order_que;   // 得点上位N個の並び順、下位から

    // ポイント合算
    rep(ti, TIME_SIZE){
        rep(mi, MUSIC_SIZE){
            rep(pi, PEOPLE_SIZE){
                sum_points[ti][mi] += points[ti][mi][pi];
            }
        }
    }

    rep(ti,TIME_SIZE){
        out_(time_names[ti]);
        outs_(sum_points[ti]); n_;
    } n_;

    // 人数分で割る
    rep(ti, TIME_SIZE){
        rep(mi, MUSIC_SIZE){
            sum_points[ti][mi] /= member_cnt[mi];
        }
    }

    //outss_(sum_points); n_;

    // // 各曲ごとのポイントの合計を平均化
    // vd sum_sum_potins(MUSIC_SIZE);
    // rep(ti, TIME_SIZE){
    //     rep(mi, MUSIC_SIZE){
    //         sum_sum_potins[mi] += sum_points[ti][mi];
    //     }
    // }

    // rep(ti, TIME_SIZE){
    //     rep(mi, MUSIC_SIZE){
    //         sum_points[ti][mi] += (double)(10000 - sum_sum_potins[mi]) / MUSIC_SIZE;
    //     }
    // }

    //rep(ti, TIME_SIZE) sum_points[ti][2] = 0;
    
    outss_(sum_points);


    // comb(MUSIC_SIZE,TIME_SIZE);


    // rep(i,50){
    //     auto [score, best_order] = top_order_que.top();
    //     top_order_que.pop();
    //     cout<<"第"<<(50-i)<<"候補"<<endl;
    //     cout<<"スコア："<<score<<"点"<<endl;
    //     rep(ti, TIME_SIZE){
    //         cout<<time_names[ti]<<" "<<music_names[best_order[ti]]<<endl;
    //     }
    //     n_;
    // }
}

/*

void out_comb(vll &sel){
    vll nums;
    rep(i, 12) if(sel[i] == 1) nums.pb(i);

    	do {
        double score = 0;
        rep(ti, 8){
            score += sum_points[ti][nums[ti]];
        }
        
        top_order_que.push({score, nums});
        if(top_order_que.size() > 50) top_order_que.pop();

	} while(next_permutation(all(nums)));    
}

*/


/*

時間数:32
楽曲数:6
人員数:26
*/