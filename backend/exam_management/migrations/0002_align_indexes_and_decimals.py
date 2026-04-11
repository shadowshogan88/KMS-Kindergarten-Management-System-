from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("exam_management", "0001_initial"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="studentexammark",
            options={"ordering": ["exam_id", "student_id", "subject_id"]},
        ),
        migrations.RenameIndex(
            model_name="auditlog",
            old_name="exam_manage_action__c89bca_idx",
            new_name="exam_manage_action__bd0f97_idx",
        ),
        migrations.RenameIndex(
            model_name="exam",
            old_name="exam_manage_class_n_65e3ca_idx",
            new_name="exam_manage_class_n_0367fe_idx",
        ),
        migrations.RenameIndex(
            model_name="exam",
            old_name="exam_manage_status__e06436_idx",
            new_name="exam_manage_status_c5ab04_idx",
        ),
        migrations.RenameIndex(
            model_name="promotion",
            old_name="exam_manage_academi_11f3b6_idx",
            new_name="exam_manage_academi_3fa148_idx",
        ),
        migrations.RenameIndex(
            model_name="promotion",
            old_name="exam_manage_student__422d2a_idx",
            new_name="exam_manage_student_9fb223_idx",
        ),
        migrations.RenameIndex(
            model_name="result",
            old_name="exam_manage_exam_id_0a902d_idx",
            new_name="exam_manage_exam_id_d74cdf_idx",
        ),
        migrations.RenameIndex(
            model_name="result",
            old_name="exam_manage_exam_id_5cd4cd_idx",
            new_name="exam_manage_exam_id_fd896e_idx",
        ),
        migrations.RenameIndex(
            model_name="resultpublishlog",
            old_name="exam_manage_exam_id_b5db44_idx",
            new_name="exam_manage_exam_id_61a0f7_idx",
        ),
        migrations.RenameIndex(
            model_name="studentexammark",
            old_name="exam_manage_exam_id_9b2a93_idx",
            new_name="exam_manage_exam_id_1432a9_idx",
        ),
        migrations.RenameIndex(
            model_name="studentexammark",
            old_name="exam_manage_exam_id_6025b4_idx",
            new_name="exam_manage_exam_id_fc1c64_idx",
        ),
        migrations.AlterField(
            model_name="result",
            name="average_marks",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=8),
        ),
        migrations.AlterField(
            model_name="result",
            name="gpa",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=4),
        ),
        migrations.AlterField(
            model_name="result",
            name="total_marks",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=8),
        ),
    ]

