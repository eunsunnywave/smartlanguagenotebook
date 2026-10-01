"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type UserProfile = {
  id: string;
  email: string | null;
  role: string;
  status: string;
};

type Word = {
  id: string;
  user_id: string;
  language: string;
  text: string;
  pinyin_text: string | null;
  meaning: string | null;
  category: string | null;
  created_at: string;
};

type Comment = {
  id: string;
  word_id: string;
  admin_id: string;
  comment: string;
  created_at: string;
};

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  const [selectedUserId, setSelectedUserId] =
    useState<string>("");

  const [commentInputs, setCommentInputs] = useState<{
    [key: string]: string;
  }>({});

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setCurrentUser(user);

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, role, status")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("관리자 확인 오류:", error);
      setErrorMessage(
        "관리자 정보를 확인하지 못했습니다."
      );
      setLoading(false);
      return;
    }

    if (profile.role !== "admin") {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    await loadUsers();
    await loadWords();
    await loadComments();

    setLoading(false);
  };

  // =========================
  // 사용자 목록 불러오기
  // =========================
  const loadUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, role, status")
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "사용자 불러오기 오류:",
        error
      );

      setErrorMessage(
        "사용자 목록을 불러오지 못했습니다."
      );

      return;
    }

    setUsers(data || []);
  };

  // =========================
  // 사용자 승인
  // =========================
  const approveUser = async (userId: string) => {
  setErrorMessage("");
  setMessage("");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      status: "approved",
    })
    .eq("id", userId)
    .select("id, email, role, status")
    .single();

  if (error) {
    console.error(
      "사용자 승인 오류:",
      error
    );

    setErrorMessage(
      "사용자 승인에 실패했습니다: " +
        error.message
    );

    return;
  }

  console.log(
    "승인된 사용자:",
    data
  );

  setUsers((prev) =>
    prev.map((user) =>
      user.id === userId
        ? {
            ...user,
            status: "approved",
          }
        : user
    )
  );

  setMessage(
    "사용자가 승인되었습니다."
  );
};


  // =========================
  // 단어 불러오기
  // =========================
  const loadWords = async () => {
    const { data, error } = await supabase
      .from("words")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "단어 불러오기 오류:",
        error
      );

      setErrorMessage(
        "사용자 단어를 불러오지 못했습니다."
      );

      return;
    }

    setWords(data || []);
  };

  // =========================
  // 코멘트 불러오기
  // =========================
  const loadComments = async () => {
    const { data, error } = await supabase
      .from("word_comments")
      .select("*")
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "코멘트 불러오기 오류:",
        error
      );

      return;
    }

    setComments(data || []);
  };

  // =========================
  // 사용자 단어 가져오기
  // =========================
  const getUserWords = (
    userId: string
  ) => {
    return words.filter(
      (word) => word.user_id === userId
    );
  };

  // =========================
  // 단어 코멘트 가져오기
  // =========================
  const getWordComment = (
    wordId: string
  ) => {
    return comments.find(
      (comment) =>
        comment.word_id === wordId
    );
  };

  // =========================
  // 관리자 코멘트 저장
  // =========================
  const saveComment = async (
    wordId: string
  ) => {
    const commentText =
      commentInputs[wordId]?.trim();

    if (!commentText) {
      return;
    }

    if (!currentUser) {
      return;
    }

    setErrorMessage("");
    setMessage("");

    const existingComment =
      getWordComment(wordId);

    if (existingComment) {
      const { data, error } =
        await supabase
          .from("word_comments")
          .update({
            comment: commentText,
          })
          .eq("id", existingComment.id)
          .select()
          .single();

      if (error) {
        console.error(
          "코멘트 수정 오류:",
          error
        );

        setErrorMessage(
          "코멘트 수정에 실패했습니다."
        );

        return;
      }

      setComments((prev) =>
        prev.map((item) =>
          item.id === existingComment.id
            ? data
            : item
        )
      );
    } else {
      const { data, error } =
        await supabase
          .from("word_comments")
          .insert({
            word_id: wordId,
            admin_id: currentUser.id,
            comment: commentText,
          })
          .select()
          .single();

      if (error) {
        console.error(
          "코멘트 저장 오류:",
          error
        );

        setErrorMessage(
          "코멘트 저장에 실패했습니다: " +
            error.message
        );

        return;
      }

      setComments((prev) => [
        ...prev,
        data,
      ]);
    }

    setCommentInputs((prev) => ({
      ...prev,
      [wordId]: "",
    }));

    setMessage(
      "코멘트가 저장되었습니다."
    );
  };

  // =========================
  // 단어 듣기
  // =========================
  const speakWord = (word: Word) => {
    if (
      !("speechSynthesis" in window)
    ) {
      setErrorMessage(
        "이 브라우저에서는 음성 재생을 지원하지 않습니다."
      );

      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        word.text
      );

    utterance.lang =
      word.language === "中文"
        ? "zh-CN"
        : "ko-KR";

    utterance.rate = 0.85;

    window.speechSynthesis.speak(
      utterance
    );
  };

  // =========================
  // 로그아웃
  // =========================
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // =========================
  // 로딩
  // =========================
  if (loading) {
    return (
      <main
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "40px 20px",
          fontFamily:
            "Arial, sans-serif",
        }}
      >
        <p>
          관리자 정보를 확인하는 중...
        </p>
      </main>
    );
  }

  // =========================
  // 로그인하지 않은 경우
  // =========================
  if (!currentUser) {
    return (
      <main
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "40px 20px",
          fontFamily:
            "Arial, sans-serif",
        }}
      >
        <h1>관리자 페이지</h1>

        <p>
          로그인이 필요합니다.
        </p>

        <button
          onClick={() => {
            window.location.href = "/";
          }}
          style={{
            padding: "10px 16px",
            cursor: "pointer",
          }}
        >
          로그인 페이지로 이동
        </button>
      </main>
    );
  }

  // =========================
  // 관리자가 아닌 경우
  // =========================
  if (!isAdmin) {
    return (
      <main
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "40px 20px",
          fontFamily:
            "Arial, sans-serif",
        }}
      >
        <h1>관리자 페이지</h1>

        <p>
          관리자 권한이 없습니다.
        </p>

        <button
          onClick={() => {
            window.location.href = "/";
          }}
          style={{
            padding: "10px 16px",
            cursor: "pointer",
          }}
        >
          내 단어장으로 이동
        </button>
      </main>
    );
  }

  // =========================
  // 관리자 페이지
  // =========================
  return (
    <main
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      {/* 상단 */}
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          marginBottom: "30px",
        }}
      >
        <div>
          <h1>관리자 페이지</h1>

          <div
            style={{
              color: "#666",
            }}
          >
            관리자:{" "}
            {currentUser.email}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          <button
            onClick={() => {
              window.location.href =
                "/";
            }}
            style={{
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            내 단어장
          </button>

          <button
            onClick={handleLogout}
            style={{
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 오류 메시지 */}
      {errorMessage && (
        <div
          style={{
            color: "red",
            marginBottom: "15px",
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* 성공 메시지 */}
      {message && (
        <div
          style={{
            color: "green",
            marginBottom: "15px",
          }}
        >
          {message}
        </div>
      )}

      {/* =========================
          사용자 관리
      ========================= */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "30px",
        }}
      >
        <h2>사용자 관리</h2>

     {users.map((user) => (
  <div
    key={user.id}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginBottom: "8px",
      flexWrap: "wrap",
    }}
  >
    <button
      onClick={() =>
        setSelectedUserId(user.id)
      }
      style={{
        padding: "10px 14px",
        cursor: "pointer",
        fontWeight:
          selectedUserId === user.id
            ? "bold"
            : "normal",
      }}
    >
      {user.email || "이메일 없음"}
    </button>

    <span
      style={{
        padding: "6px 10px",
        borderRadius: "6px",
        background:
          user.status === "approved"
            ? "#dcfce7"
            : "#fef3c7",
        color:
          user.status === "approved"
            ? "#166534"
            : "#92400e",
        fontSize: "13px",
      }}
    >
      {user.status === "approved"
        ? "승인됨"
        : "승인 대기"}
    </span>

    {user.status !== "approved" && (
      <button
        onClick={() =>
          approveUser(user.id)
        }
        style={{
          padding: "7px 12px",
          cursor: "pointer",
          background: "#2563eb",
          color: "white",
          border: "none",
          borderRadius: "6px",
        }}
      >
        승인
      </button>
    )}
  </div>
))}


      

        {users.length === 0 && (
          <p>
            등록된 사용자가 없습니다.
          </p>
        )}
      </section>

      {/* =========================
          선택된 사용자 단어장
      ========================= */}
      {selectedUserId ? (
        <section>
          {(() => {
            const selectedUser =
              users.find(
                (user) =>
                  user.id ===
                  selectedUserId
              );

            const userWords =
              getUserWords(
                selectedUserId
              );

            return (
              <>
                <h2>
                  {selectedUser?.email}
                  님의 단어장
                </h2>

                <div
                  style={{
                    marginBottom:
                      "20px",
                    color: "#666",
                  }}
                >
                  저장된 단어:{" "}
                  {userWords.length}개
                </div>

                {userWords.length ===
                0 ? (
                  <p>
                    저장된 단어가
                    없습니다.
                  </p>
                ) : (
                  userWords.map(
                    (word) => {
                      const existingComment =
                        getWordComment(
                          word.id
                        );

                      return (
                        <div
                          key={word.id}
                          style={{
                            border:
                              "1px solid #ddd",
                            borderRadius:
                              "12px",
                            padding:
                              "18px",
                            marginBottom:
                              "15px",
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              gap: "15px",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize:
                                    "12px",
                                  color:
                                    "#666",
                                  marginBottom:
                                    "6px",
                                }}
                              >
                                {word.category ||
                                  "기타"}{" "}
                                ·{" "}
                                {
                                  word.language
                                }
                              </div>

                              <div
                                style={{
                                  fontSize:
                                    "20px",
                                  fontWeight:
                                    "bold",
                                }}
                              >
                                {
                                  word.text
                                }
                              </div>

                              {word.pinyin_text && (
                                <div
                                  style={{
                                    marginTop:
                                      "6px",
                                  }}
                                >
                                  {
                                    word.pinyin_text
                                  }
                                </div>
                              )}

                              {word.meaning && (
                                <div
                                  style={{
                                    marginTop:
                                      "6px",
                                    color:
                                      "#555",
                                  }}
                                >
                                  {
                                    word.meaning
                                  }
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() =>
                                speakWord(
                                  word
                                )
                              }
                              style={{
                                padding:
                                  "8px 12px",
                                cursor:
                                  "pointer",
                                height:
                                  "fit-content",
                              }}
                            >
                              🔊 듣기
                            </button>
                          </div>

                          {/* 관리자 코멘트 */}
                          <div
                            style={{
                              marginTop:
                                "20px",
                              paddingTop:
                                "15px",
                              borderTop:
                                "1px solid #eee",
                            }}
                          >
                            <div
                              style={{
                                fontWeight:
                                  "bold",
                                marginBottom:
                                  "8px",
                              }}
                            >
                              💬 관리자
                              코멘트
                            </div>

                            {existingComment && (
                              <div
                                style={{
                                  padding:
                                    "10px",
                                  background:
                                    "#f5f5f5",
                                  borderRadius:
                                    "8px",
                                  marginBottom:
                                    "10px",
                                }}
                              >
                                {
                                  existingComment.comment
                                }
                              </div>
                            )}

                            <textarea
                              value={
                                commentInputs[
                                  word.id
                                ] || ""
                              }
                              onChange={(
                                e
                              ) =>
                                setCommentInputs(
                                  (
                                    prev
                                  ) => ({
                                    ...prev,
                                    [word.id]:
                                      e
                                        .target
                                        .value,
                                  })
                                )
                              }
                              placeholder={
                                existingComment
                                  ? "코멘트를 수정하세요"
                                  : "이 단어에 코멘트를 남겨보세요"
                              }
                              rows={3}
                              style={{
                                width:
                                  "100%",
                                padding:
                                  "10px",
                                boxSizing:
                                  "border-box",
                                resize:
                                  "vertical",
                                marginBottom:
                                  "8px",
                              }}
                            />

                            <button
                              onClick={() =>
                                saveComment(
                                  word.id
                                )
                              }
                              style={{
                                padding:
                                  "8px 14px",
                                cursor:
                                  "pointer",
                              }}
                            >
                              {existingComment
                                ? "코멘트 수정"
                                : "코멘트 저장"}
                            </button>
                          </div>
                        </div>
                      );
                    }
                  )
                )}
              </>
            );
          })()}
        </section>
      ) : (
        <section
          style={{
            padding: "30px",
            background: "#f8f8f8",
            borderRadius: "12px",
            textAlign: "center",
          }}
        >
          <p>
            위에서 사용자를 선택하면
            해당 사용자의 단어장이
            표시됩니다.
          </p>
        </section>
      )}
    </main>
  );
}
