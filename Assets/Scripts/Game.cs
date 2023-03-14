using Assets.Scripts;
using Assets.Scripts.Pawns;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class Game : MonoBehaviour
{
    public GameObject pawn;

    private GameObject[,] positions = new GameObject[7,7];
    private GameObject[] playerRedPieces = new GameObject[14];
    private GameObject[] playerBluePieces = new GameObject[14];

    private Player currentPlayer = Player.Blue;

    private bool gameOver = false;

    // Start is called before the first frame update
    void Start()
    {
        playerBluePieces = new GameObject[] {
            CreatePawn(Player.Blue, PawnType.Attack, 0, 0),
            CreatePawn(Player.Blue, PawnType.Support, 1, 0),
            CreatePawn(Player.Blue, PawnType.Attack, 2, 0),
            CreatePawn(Player.Blue, PawnType.Push, 3, 0),
            CreatePawn(Player.Blue, PawnType.Attack, 4, 0),
            CreatePawn(Player.Blue, PawnType.Support, 5, 0),
            CreatePawn(Player.Blue, PawnType.Attack, 6, 0),

            CreatePawn(Player.Blue, PawnType.Attack, 0, 1),
            CreatePawn(Player.Blue, PawnType.Push, 1, 1),
            CreatePawn(Player.Blue, PawnType.Attack, 2, 1),
            CreatePawn(Player.Blue, PawnType.Push, 3, 1),
            CreatePawn(Player.Blue, PawnType.Attack, 4, 1),
            CreatePawn(Player.Blue, PawnType.Push, 5, 1),
            CreatePawn(Player.Blue, PawnType.Attack, 6, 1),
        };

        playerRedPieces = new GameObject[] {
            CreatePawn(Player.Red, PawnType.Attack, 0, 6),
            CreatePawn(Player.Red, PawnType.Support, 1, 6),
            CreatePawn(Player.Red, PawnType.Attack, 2, 6),
            CreatePawn(Player.Red, PawnType.Push, 3, 6),
            CreatePawn(Player.Red, PawnType.Attack, 4, 6),
            CreatePawn(Player.Red, PawnType.Support, 5, 6),
            CreatePawn(Player.Red, PawnType.Attack, 6, 6),

            CreatePawn(Player.Red, PawnType.Attack, 0, 5),
            CreatePawn(Player.Red, PawnType.Push, 1, 5),
            CreatePawn(Player.Red, PawnType.Attack, 2, 5),
            CreatePawn(Player.Red, PawnType.Push, 3, 5),
            CreatePawn(Player.Red, PawnType.Attack, 4, 5),
            CreatePawn(Player.Red, PawnType.Push, 5, 5),
            CreatePawn(Player.Red, PawnType.Attack, 6, 5),
        };

        foreach (GameObject redPiece in playerRedPieces) {
            SetPawnPosition(redPiece);
        }
        foreach (GameObject bluePiece in playerBluePieces) {
            SetPawnPosition(bluePiece);
        }
    }

    public GameObject CreatePawn(Player player, PawnType pawnType, int x, int y)
    {
        var obj = Instantiate(pawn, new Vector3(x, y, -1), Quaternion.identity);

        switch(pawnType)
        {
            case PawnType.Attack:
                obj.AddComponent<AttackPawnLogic>();
                break;
            case PawnType.Push:
                obj.AddComponent<PushPawnLogic>();
                break;
            case PawnType.Support:
                obj.AddComponent<SupportPawnLogic>();
                break;
            case PawnType.Neutral:
                obj.AddComponent<NeutralPawnLogic>(); 
                break;
        }
        var pawnComponent = obj.GetComponent<PawnLogicBase>();

        pawnComponent.Init(player, x, y);

        return obj;
    }

    public void SetPawnPosition(GameObject obj) {
        PawnLogicBase p = obj.GetComponent<PawnLogicBase>();
        positions[p.XBoardPosition, p.YBoardPosition] = obj;
    }

    public void TakeAtPosition(GameObject attacker, int x, int y)
    {
        if(positions[x, y] != null)
        {
            Destroy(positions[x, y]);
            var pawnLogic = attacker.GetComponent<PawnLogicBase>();
            pawnLogic.SetPosition(x, y);
            positions[x, y] = attacker;
        }
    }

    //public bool PositionOnBoard(int x, int y)
    //{
    //    return positions[x, y];
    //}
}
