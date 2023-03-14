using Assets.Scripts.Pawns;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class MovePlate : MonoBehaviour
{
    public GameObject controller;
    private GameObject originalPawn = null;

    public int xPosition { get; set; }
    public int yPosition { get; set; }

    public bool isAttack = false;

    public void Start()
    {
        controller = GameObject.FindGameObjectWithTag("GameController");
        if (isAttack)
        {
            GetComponent<SpriteRenderer>().color = Color.red;
        }
    }

    public void Init(GameObject origin, int x, int y)
    {
        originalPawn = origin;
        xPosition = x;
        yPosition = y;
    }

    public void OnMouseUp()
    {
        if(isAttack)
        {
            controller.GetComponent<Game>().TakeAtPosition(originalPawn, xPosition, yPosition);
            originalPawn.GetComponent<PawnLogicBase>().DestroyMovePlates();
        }
    }
}
