using Assets.Scripts;
using System;
using UnityEngine;
namespace Assets.Scripts.Pawns
{
    public abstract class PawnLogicBase : MonoBehaviour
    {
        public GameObject controller;
        public GameObject movePlate;

        //Positions
        public int XBoardPosition { get; set; } = -1;
        public int YBoardPosition { get; set; } = -1;

        //Players
        private Player player;
        

        public void Start()
        {
            controller = GameObject.FindGameObjectWithTag("GameController");
        }

        public virtual void Init(Player p, int x, int y)
        {
            player = p;

            SetPosition(x, y);
        }

        public void SetPosition(int x, int y)
        {
            XBoardPosition = x;
            YBoardPosition = y;

            float xScreenPosition = XBoardPosition;
            float yScreenPosition = YBoardPosition;

            xScreenPosition *= 1.18f;
            yScreenPosition *= 1.18f;

            xScreenPosition += -3.54f;
            yScreenPosition += -3.54f;

            transform.position = new Vector3(xScreenPosition, yScreenPosition, -1);
        }

        private void OnMouseUp()
        {
            DestroyMovePlates();

            InitiateMovePlates();
        }

        public void DestroyMovePlates()
        {
            GameObject[] movePlates = GameObject.FindGameObjectsWithTag("MovePlate");
            foreach (var movePlate in movePlates)
            {
                Destroy(movePlate);
            }
        }

        public void InitiateMovePlates()
        {

        }
    }

}
